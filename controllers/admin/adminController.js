const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Order = require("../../models/orderSchema");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { HttpStatus } = require("../../shared/constants");

const pageerror = async (req, res) => {
  res.render("pageerror");
};

const loadLogin = (req, res) => {
  try {
    if (req.session.admin) {
      return res.render("admin/admin-login");
    }
    res.render("admin-login", { message: null });
  } catch (error) {
    console.error(erro);
    console.log("error in load login");
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await User.findOne({ email, isAdmin: true });
    if (!admin) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Invalid credentials" });
    }

    req.session.admin = admin;

    res.status(200).json({
      message: "Login successful",
      redirectUrl: "/admin/home",
    });
  } catch (error) {
    console.error("Error in admin login function", error);
    res
      .status(HttpStatus.SERVER_ERROR)
      .json({ message: "Internal Server Error" });
  }
};

const loadDashboard = async (req, res) => {
  try {
    res.render("dashboard");
  } catch (error) {
    console.error(error);
    console.log("error in load dashboard function");
  }
};

const getDashboardData = async (req, res) => {
  try {
    const { filter = "yearly" } = req.query;

    // Summary Data
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $match: { status: "Delivered" } },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } },
    ]).then((result) => result[0]?.total || 0);
    const totalDiscount = await Order.aggregate([
      { $match: { discount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$discount" } } },
    ]).then((result) => result[0]?.total || 0);

    const summary = {
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      totalDiscount,
    };

    // Revenue & Orders Data
    let revenueOrders = { labels: [], revenue: [], orders: [] };
    let dateRange;
    switch (filter) {
      case "daily":
        dateRange = { $gte: new Date(new Date().setHours(0, 0, 0, 0)) };
        const hourlyData = await Order.aggregate([
          { $match: { createdOn: dateRange } },
          {
            $group: {
              _id: { $hour: "$createdOn" },
              revenue: { $sum: "$finalAmount" },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]);
        revenueOrders.labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
        revenueOrders.revenue = Array.from(
          { length: 24 },
          (_, i) => hourlyData.find((d) => d._id === i)?.revenue || 0
        );
        revenueOrders.orders = Array.from(
          { length: 24 },
          (_, i) => hourlyData.find((d) => d._id === i)?.count || 0
        );
        break;
      case "monthly":
        const startOfMonth = new Date();
        startOfMonth.setDate(1); // Set to first day of the month
        startOfMonth.setHours(0, 0, 0, 0); // Reset time to 00:00:00.000
        dateRange = { $gte: startOfMonth };
        const dailyData = await Order.aggregate([
          { $match: { createdOn: dateRange } },
          {
            $group: {
              _id: { $dayOfMonth: "$createdOn" },
              revenue: { $sum: "$finalAmount" },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]);
        console.log("here is the dailydata in month filter =>", dailyData);
        const daysInMonth = new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          0
        ).getDate();
        revenueOrders.labels = Array.from(
          { length: daysInMonth },
          (_, i) => `Day ${i + 1}`
        );
        revenueOrders.revenue = Array.from(
          { length: daysInMonth },
          (_, i) => dailyData.find((d) => d._id === i + 1)?.revenue || 0
        );
        revenueOrders.orders = Array.from(
          { length: daysInMonth },
          (_, i) => dailyData.find((d) => d._id === i + 1)?.count || 0
        );
        break;
      case "yearly":
        dateRange = { $gte: new Date(new Date().setMonth(0, 1)) };
        const monthlyData = await Order.aggregate([
          { $match: { createdOn: dateRange } },
          {
            $group: {
              _id: { $month: "$createdOn" },
              revenue: { $sum: "$finalAmount" },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]);
        revenueOrders.labels = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        revenueOrders.revenue = Array.from(
          { length: 12 },
          (_, i) => monthlyData.find((d) => d._id === i + 1)?.revenue || 0
        );
        revenueOrders.orders = Array.from(
          { length: 12 },
          (_, i) => monthlyData.find((d) => d._id === i + 1)?.count || 0
        );
        break;
    }
    // Top Products
    const topProducts = await Order.aggregate([
      { $unwind: "$orderedItems" },
      {
        $group: {
          _id: "$orderedItems.product",
          sales: { $sum: "$orderedItems.quantity" },
        },
      },
      { $sort: { sales: -1 } },
      { $limit: 3 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $project: { name: "$product.productName", sales: 1 } },
    ]);

    // Top Categories
    const topCategories = await Order.aggregate([
      { $unwind: "$orderedItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.category",
          sales: { $sum: "$orderedItems.quantity" },
        },
      },
      { $sort: { sales: -1 } },
      { $limit: 2 },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      { $project: { name: "$category.name", sales: 1 } },
    ]);

    // Top Brands
    const topBrands = await Order.aggregate([
      { $unwind: "$orderedItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.brand",
          sales: { $sum: "$orderedItems.quantity" },
        },
      },
      { $sort: { sales: -1 } },
      { $limit: 4 },
      { $project: { name: "$_id", sales: 1 } },
    ]);

    // // Recent Orders
    // const recent10  = await Order.find({}).sort({crea})
    // console.log('recent 10 orders, ')
    const recentOrders = await Order.find()
      .sort({ createdOn: -1 })
      .limit(5)
      .populate("userId", "name")
      .populate("orderedItems.product", "productName")
      .lean()
      .then((orders) => {
        return orders.map((order) => ({
          orderId: order.orderId,
          customer: order.userId?.name || "Unknown Customer",
          product:
            order.orderedItems?.length > 0 &&
            order.orderedItems[0].product?.productName
              ? order.orderedItems[0].product.productName
              : "No Product",
          amount: order.finalAmount || 0,
          status: order.status || "Unknown",
          date: order.createdOn || new Date(),
        }));
      });

    res.json({
      summary,
      revenueOrders,
      topProducts,
      topCategories,
      topBrands,
      recentOrders,
    });
  } catch (error) {
    console.error(error);
    res
      .status(HttpStatus.SERVER_ERROR)
      .json({ error: "Error fetching dashboard data" });
  }
};

const downloadReport = async (req, res) => {
  try {
    const doc = new PDFDocument();

    // Set headers for direct PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');

    doc.pipe(res); // Pipe the PDF directly to the response

    doc.fontSize(20).text("Admin Dashboard Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text(`Generated on: ${new Date().toLocaleString()}`);
    doc.moveDown();

    // Add summary data
    const summary = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$finalAmount" },
          totalOrders: { $sum: 1 },
        },
      },
    ]).then((result) => result[0] || { totalRevenue: 0, totalOrders: 0 });

    doc.text(`Total Revenue: ₹${summary.totalRevenue.toLocaleString()}`);
    doc.text(`Total Orders: ${summary.totalOrders}`);
    doc.moveDown();

    // Add top products
    const topProducts = await Order.aggregate([
      { $unwind: "$orderedItems" },
      {
        $group: {
          _id: "$orderedItems.product",
          sales: { $sum: "$orderedItems.quantity" },
        },
      },
      { $sort: { sales: -1 } },
      { $limit: 3 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $project: { name: "$product.productName", sales: 1 } },
    ]);

    doc.text("Top Products:");
    topProducts.forEach((product, index) => {
      doc.text(`${index + 1}. ${product.name} - ${product.sales} units`);
    });
    doc.moveDown();

    // Add top categories
    const topCategories = await Order.aggregate([
      { $unwind: "$orderedItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.category",
          sales: { $sum: "$orderedItems.quantity" },
        },
      },
      { $sort: { sales: -1 } },
      { $limit: 2 },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      { $project: { name: "$category.name", sales: 1 } },
    ]);

    doc.text("Top Categories:");
    topCategories.forEach((category, index) => {
      doc.text(`${index + 1}. ${category.name} - ${category.sales} units`);
    });
    doc.moveDown();

    // Add top brands
    const topBrands = await Order.aggregate([
      { $unwind: "$orderedItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.brand",
          sales: { $sum: "$orderedItems.quantity" },
        },
      },
      { $sort: { sales: -1 } },
      { $limit: 4 },
      { $project: { name: "$_id", sales: 1 } },
    ]);

    doc.text("Top Brands:");
    topBrands.forEach((brand, index) => {
      doc.text(`${index + 1}. ${brand.name} - ${brand.sales} units`);
    });
    doc.moveDown();

    doc.end(); 
  } catch (error) {
    console.error(error);
    res.status(HttpStatus.SERVER_ERROR).send("Error generating report");
  }
};


const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error destroying session", err);
        return res.redirect("/admin/pageerror");
      }
      res.redirect("/admin/login");
    });
  } catch (error) {
    console.log(("unexpected error during logout", error));
    res.redirect("/admin/pageerror");
  }
};

module.exports = {
  loadLogin,
  login,
  loadDashboard,
  getDashboardData,
  downloadReport,
  pageerror,
  logout,
};
