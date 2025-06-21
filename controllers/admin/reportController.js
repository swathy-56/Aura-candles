const Order = require("../../models/orderSchema");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const { HttpStatus } = require("../../shared/constants");

const getSalesReportPage = async (req, res) => {
  try {
    const report = req.session.salesReport || {
      orders: await Order.find({})
        .sort({ createdOn: -1 })
        .populate("orderedItems.product"),
      totalSales: 0,
      totalDiscount: 0,
      totalFinalAmount: 0,
      totalOrders: 0,
    };

    report.orders = report.orders.map((order) => {
      order.createdOn = new Date(order.createdOn);
      return order;
    });

    report.totalSales = report.orders.reduce(
      (sum, order) => sum + order.totalPrice,
      0
    );
    report.totalDiscount = report.orders.reduce(
      (sum, order) => sum + order.discount,
      0
    );
    report.totalFinalAmount = report.orders.reduce(
      (sum, order) => sum + order.finalAmount,
      0
    );
    report.totalOrders = report.orders.length;

    res.render("sales-report", {
      orders: report.orders,
      totalSales: report.totalSales,
      totalDiscount: report.totalDiscount,
      totalFinalAmount: report.totalFinalAmount,
      totalOrders: report.totalOrders,
    });
  } catch (error) {
    console.error("Error in getSalesReportPage:", error);
    res
      .status(HttpStatus.SERVER_ERROR)
      .send("Server Error: Unable to load sales report");
  }
};

const generateSalesReport = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.body;
    let dateFilter = {};

    const now = new Date();
    switch (reportType) {
      case "daily":
        dateFilter = {
          createdOn: {
            $gte: new Date(now.setHours(0, 0, 0, 0)),
            $lte: new Date(now.setHours(23, 59, 59, 999)),
          },
        };
        break;
      case "weekly":
        dateFilter = {
          createdOn: {
            $gte: new Date(now.setDate(now.getDate() - 7)),
            $lte: new Date(),
          },
        };
        break;
      case "monthly":
        dateFilter = {
          createdOn: {
            $gte: new Date(now.setMonth(now.getMonth() - 1)),
            $lte: new Date(),
          },
        };
        break;
      case "custom":
        if (!startDate || !endDate) {
          return res.json({
            success: false,
            message: "Start and end dates are required for custom range",
          });
        }
        dateFilter = {
          createdOn: {
            $gte: new Date(startDate).setHours(0, 0, 0),
            $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
          },
        };
        break;
      default:
        return res.json({ success: false, message: "Invalid report type" });
    }

    const orders = await Order.find({
      ...dateFilter,
    })
      .sort({ createdOn: -1 })
      .populate("orderedItems.product");

    const formattedOrders = orders.map((order) => {
      order.createdOn = new Date(order.createdOn);
      return order;
    });

    const totalSales = formattedOrders.reduce(
      (sum, order) => sum + order.totalPrice,
      0
    );
    const totalDiscount = formattedOrders.reduce(
      (sum, order) => sum + order.discount,
      0
    );
    const totalFinalAmount = formattedOrders.reduce(
      (sum, order) => sum + order.finalAmount,
      0
    );
    const totalOrders = formattedOrders.length;

    req.session.salesReport = {
      orders: formattedOrders,
      totalSales,
      totalDiscount,
      totalFinalAmount,
      totalOrders,
    };

    res.json({ success: true });
  } catch (error) {
    console.error("Error in generateSalesReport:", error);
    res.json({ success: false, message: "Error generating report" });
  }
};


const downloadSalesReport = async (req, res) => {
  try {
    const { format } = req.body;
    const report = req.session.salesReport;

    // Validate session data
    if (!report || !Array.isArray(report.orders) || report.orders.length === 0) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({
          success: false,
          message: "No sales report data available. Generate a report first.",
        });
    }

    console.log(
      "Session report before PDF download:",
      JSON.stringify(report.orders, null, 2)
    );

    // Validate and format order data
    report.orders = report.orders.map((order) => {
      const createdOn = new Date(order.createdOn);
      if (isNaN(createdOn.getTime())) {
        console.warn(
          `Invalid date for order ${order.orderId || 'unknown'}: ${order.createdOn}. Using current date.`
        );
        order.createdOn = new Date();
      } else {
        order.createdOn = createdOn;
      }
      // Ensure required fields are present
      order.orderId = order.orderId || 'N/A';
      order.totalPrice = Number.isFinite(order.totalPrice) ? order.totalPrice : 0;
      order.discount = Number.isFinite(order.discount) ? order.discount : 0;
      order.finalAmount = Number.isFinite(order.finalAmount) ? order.finalAmount : 0;
      order.paymentMethod = order.paymentMethod || 'N/A';
      order.coupon = order.coupon || { code: 'None' };
      return order;
    });

    if (format !== "pdf") {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: "Invalid format. Only PDF is supported." });
    }

    // Initialize PDF document
    const doc = new PDFDocument({ margin: 30, size: "A4" });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="sales-report-${new Date().toISOString().split("T")[0]}.pdf"`
    );

    // Pipe PDF directly to response
    doc.pipe(res);

    // Handle PDF stream errors
    doc.on('error', (err) => {
      console.error('PDFKit stream error:', err);
      if (!res.headersSent) {
        res
          .status(HttpStatus.SERVER_ERROR)
          .json({ success: false, message: 'Error generating PDF: ' + err.message });
      }
    });

    // Use Helvetica font to support INR symbol
    doc.font("Helvetica");

    // Header Section
    doc
      .fontSize(22)
      .text("Sales Report", { align: "center" });
    doc
      .fontSize(12)
      .text(
        `Aura Candles | Generated on: ${new Date().toLocaleDateString()}`,
        { align: "center" }
      );
    doc.moveDown(1.5);
    doc.moveTo(30, doc.y).lineTo(565, doc.y).stroke("#E0E0E0");
    doc.moveDown(1);

    // Table Setup
    const tableTop = doc.y;
    const colWidths = [90, 80, 80, 70, 70, 100]; // Total 498
    const tableWidth = colWidths.reduce((sum, width) => sum + width, 0); // 498
    const tableLeft = 30; // Consistent left edge
    const tableRight = tableLeft + tableWidth; // 528
    const headers = [
      "Order ID",
      "Date",
      "Total Amount",
      "Discount",
      "Final Amount",
      "Payment Method",
    ];

    // Table Header
    doc
      .rect(tableLeft, tableTop - 5, tableWidth, 25)
      .fill("#F5F5F5")
      .stroke("#D3D3D3");
    doc.fillColor("#333333");
    let xPos = tableLeft;
    headers.forEach((header, i) => {
      doc
        .fontSize(11)
        .text(header, xPos, tableTop + 5, {
          width: colWidths[i],
          align: "center",
        });
      xPos += colWidths[i];
    });

    // Table Rows
    let yPos = tableTop + 30;
    doc.fontSize(10).fillColor("#000000");
    report.orders.forEach((order, index) => {
      xPos = tableLeft; // Align with table left edge
      const row = [
        order.orderId,
        order.createdOn.toLocaleDateString(),
        `Rs.${order.totalPrice.toFixed(2)}`,
        `Rs.${order.discount.toFixed(2)}`,
        `Rs.${order.finalAmount.toFixed(2)}`,
        order.paymentMethod,
      ];

      if (index % 2 === 0) {
        doc.rect(tableLeft, yPos - 5, tableWidth, 20).fill("#FAFAFA");
      }
      doc.fillColor("#000000");

      row.forEach((cell, i) => {
        const align = (i === 2 || i === 3 || i === 4) ? "center" : "center";
        const paddingLeft = 0;
        doc.text(cell, xPos + paddingLeft, yPos, {
          width: colWidths[i] - paddingLeft,
          align,
        });
        xPos += colWidths[i];
      });

      yPos += 20;

      if (yPos > doc.page.height - 80) {
        doc.addPage();
        yPos = 50;
        xPos = tableLeft;
        doc
          .rect(tableLeft, yPos - 5, tableWidth, 25)
          .fill("#F5F5F5")
          .stroke("#D3D3D3");
        doc.fillColor("#333333");
        headers.forEach((header, i) => {
          doc
            .fontSize(11)
            .text(header, xPos, yPos + 5, {
              width: colWidths[i],
              align: "center",
            });
          xPos += colWidths[i];
        });
        yPos += 30;
        doc.fontSize(10).fillColor("#000000");
      }
    });

    // Totals Section
    doc.moveDown(1);
    doc.moveTo(tableLeft, yPos).lineTo(tableRight, yPos).stroke("#E0E0E0");
    yPos += 10;
    doc
      .fontSize(12)
      .text("Summary", tableLeft, yPos);
    doc.fontSize(11);
    const totals = [
      `Total Orders: ${report.totalOrders}`,
      `Total Sales: Rs. ${report.totalSales.toFixed(2)}`,
      `Total Discount: Rs.${report.totalDiscount.toFixed(2)}`,
      `Final Amount: Rs.${report.totalFinalAmount.toFixed(2)}`,
    ];
    totals.forEach((text, i) => {
      doc.text(text, tableRight - 200 - (i % 2) * 150, yPos + Math.floor(i / 2) * 20, {
        align: "center",
        width: 200,
      });
    });

    // Footer
    const footerY = doc.page.height - 40;
    doc
      .moveTo(tableLeft, footerY - 10)
      .lineTo(tableRight, footerY - 10)
      .stroke("#E0E0E0");
    doc
      .fontSize(9)
      .text("Aura Candles - Sales Report", tableLeft, footerY, { align: "center", width: tableWidth });

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error("Error in downloadSalesReport:", error);
    if (!res.headersSent) {
      res
        .status(HttpStatus.SERVER_ERROR)
        .json({
          success: false,
          message: "Error downloading PDF report: " + error.message,
        });
    }
  }
};


const downloadExcelReport = async (req, res) => {
  try {
    const report = req.session.salesReport;

    if (!report || !report.orders) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({
          success: false,
          message: "No sales report data available. Generate a report first.",
        });
    }

    console.log('hellooooooooooooooooooooooooooo');

    report.orders = report.orders.map((order) => {
      const createdOn = new Date(order.createdOn);
      if (isNaN(createdOn.getTime())) {
        console.error(
          `Invalid date for order ${order.orderId}: ${order.createdOn}`
        );
        order.createdOn = new Date();
      } else {
        order.createdOn = createdOn;
      }
      order.paymentMethod = order.paymentMethod || 'N/A';
      return order;
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Aura Candles";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet("Sales Report");

    // Header
    worksheet.mergeCells("A1:G1");
    worksheet.getCell("A1").value = "Sales Report - Aura Candles";
    worksheet.getCell("A1").font = { name: "Helvetica", size: 16, bold: true };
    worksheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    worksheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    worksheet.mergeCells("A2:G2");
    worksheet.getCell(
      "A2"
    ).value = `Generated on: ${new Date().toLocaleDateString()}`;
    worksheet.getCell("A2").font = { name: "Helvetica", size: 12 };
    worksheet.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    // Column Headers
    const headers = [
      "Order ID",
      "Date",
      "Total Amount",
      "Discount",
      "Final Amount",
      "Payment Method",
    ];
    worksheet.getRow(4).values = headers;
    worksheet.getRow(4).font = { name: "Helvetica", size: 11, bold: true };
    worksheet.getRow(4).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF5F5F5" },
    };
    worksheet.getRow(4).alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    // Column Widths
    worksheet.columns = [
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 20 },
    ];

    // Data Rows
    report.orders.forEach((order, index) => {
      const row = worksheet.addRow([
        order.orderId || "N/A",
        order.createdOn.toLocaleDateString(),
        `Rs.${order.totalPrice.toFixed(2)}`,
        `Rs.${order.discount.toFixed(2)}`,
        `Rs.${order.finalAmount.toFixed(2)}`,
        order.paymentMethod,
      ]);
      row.font = { name: "Helvetica", size: 10 };
      row.alignment = { vertical: "middle" };
      row.getCell(3).alignment = { horizontal: "right" };
      row.getCell(4).alignment = { horizontal: "right" };
      row.getCell(5).alignment = { horizontal: "right" };
      row.getCell(6).alignment = { horizontal: "center" };
      if (index % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFAFAFA" },
        };
      }
    });

    // Summary Section
    const summaryRow = worksheet.addRow([]);
    worksheet.addRow(["Summary"]).font = {
      name: "Helvetica",
      size: 12,
      bold: true,
    };
    const totals = [
      ["Total Orders", report.totalOrders],
      ["Total Sales", `Rs.${report.totalSales.toFixed(2)}`],
      ["Total Discount", `Rs.${report.totalDiscount.toFixed(2)}`],
      ["Final Amount", `Rs.${report.totalFinalAmount.toFixed(2)}`],
    ];
    totals.forEach(([label, value], i) => {
      const row = worksheet.addRow([label, "", "", "", "", "", value]);
      row.font = { name: "Helvetica", size: 11 };
      row.getCell(1).font = { name: "Helvetica", size: 11, bold: true };
      row.getCell(7).alignment = { horizontal: "right" };
    });

    // Footer
    const footerRow = worksheet.addRow(["Aura Candles - Sales Report"]);
    worksheet.mergeCells(`A${footerRow.number}:G${footerRow.number}`);
    footerRow.font = {
      name: "Helvetica",
      size: 9,
      italic: true,
      color: { argb: "FF666666" },
    };
    footerRow.alignment = { horizontal: "center", vertical: "middle" };

    // Write to response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="sales-report-${
        new Date().toISOString().split("T")[0]
      }.xlsx"`
    );
    await workbook.xlsx.write(res);
  } catch (error) {
    console.error("Error in downloadExcelReport:", error);
    res
      .status(HttpStatus.SERVER_ERROR)
      .json({
        success: false,
        message: "Error downloading Excel report: " + error.message,
      });
  }
};

module.exports = {
  getSalesReportPage,
  generateSalesReport,
  downloadSalesReport,
  downloadExcelReport,
};