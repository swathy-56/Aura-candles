const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { HttpStatus } = require("../../shared/constants");

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });
    res.render("product-add", { cat: category, brand: brand });
  } catch (error) {
    console.error("Error in getProductAddPage:", error);
    res.redirect("/admin/pageerror");
  }
};

const addProducts = async (req, res) => {
  try {
    const products = req.body;
    const productExists = await Product.findOne({
      productName: products.productName,
    });

    if (productExists) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({
          status: false,
          message: "Product already exists. Please try with another name",
        });
    }

    const images = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const originalPath = req.files[i].path;
        const resizedImagePath = path.join(
          "public",
          "uploads",
          "product-images",
          req.files[i].filename
        );
        await sharp(originalPath)
          .resize({ width: 440, height: 440 })
          .toFile(resizedImagePath);
        images.push(req.files[i].filename);
      }
    }

    const categoryId = await Category.findOne({ name: products.category });
    if (!categoryId) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ status: false, message: "Invalid category name" });
    }

    const newProduct = new Product({
      productName: products.productName,
      description: products.description,
      brand: products.brand,
      category: categoryId._id,
      regularPrice: parseFloat(products.regularPrice),
      quantity: parseInt(products.quantity),
      size: products.size,
      productImage: images,
      status: "Available",
    });

    await newProduct.save();
    return res.json({ status: true, message: "Product added successfully" });
  } catch (error) {
    console.error("Error saving product:", error);
    return res
      .status(HttpStatus.SERVER_ERROR)
      .json({ status: false, message: "Error adding product" });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = req.query.page || 1;
    const limit = 4;

    const productData = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    })
      .sort({ createdAt:-1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("category")
      .exec();
    
    const count = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    }).countDocuments();
    

    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });

    const productsWithPrices = productData.map((product) => {
      const categoryOffer = product.category?.categoryOffer || 0;
      const bestOffer = Math.max(product.productOffer, categoryOffer);
      const finalPrice =
        product.regularPrice -
        Math.floor(product.regularPrice * (bestOffer / 100));
      return {
        ...product.toObject(),
        finalPrice,
        appliedOffer: bestOffer,
      };
    });

    if (category && brand) {
      res.render("products", {
        data: productData,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        cat: category,
        brand: brand,
      });
    } else {
      res.render("page-HttpStatus.NOT_FOUND");
    }
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

const addProductOffer = async (req, res) => {
  try {
    const { productId, percentage } = req.body;
    const findProduct = await Product.findOne({ _id: productId });
    if (!findProduct) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ status: false, message: "Product not found" });
    }

    findProduct.productOffer = parseInt(percentage);
    await findProduct.save();

    res.json({ status: true, message: "Product offer added successfully" });
  } catch (error) {
    console.error("Error in addProductOffer:", error);
    res
      .status(HttpStatus.SERVER_ERROR)
      .json({ status: false, message: "Internal Server Error" });
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;
    const findProduct = await Product.findOne({ _id: productId });
    if (!findProduct) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ status: false, message: "Product not found" });
    }
    if (findProduct.productOffer === 0) {
      return res.json({ status: false, message: "No offer to remove" });
    }

    findProduct.productOffer = 0;
    await findProduct.save();
    res.json({ status: true, message: "Product offer removed successfully" });
  } catch (error) {
    console.error("Error removing product offer:", error);
    res
      .status(HttpStatus.SERVER_ERROR)
      .json({ status: false, message: "Internal Server Error" });
  }
};

const blockProduct = async (req, res) => {
  try {
    let id = req.body.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.json({ status: true, message: "Product blocked successfully" });
  } catch (error) {
    console.error("Error blocking product:", error);
    res
      .status(HttpStatus.SERVER_ERROR)
      .json({ status: false, message: "Error blocking product" });
  }
};

const unblockProduct = async (req, res) => {
  try {
    let id = req.body.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.json({ status: true, message: "Product unblocked successfully" });
  } catch (error) {
    console.error("Error unblocking product:", error);
    res
      .status(HttpStatus.SERVER_ERROR)
      .json({ status: false, message: "Error unblocking product" });
  }
};

const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findOne({ _id: id });
    const category = await Category.find({});
    const brand = await Brand.find({});
    res.render("edit-product", {
      product: product,
      cat: category,
      brand: brand,
    });
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

const editProduct = async (req, res) => {
  try {
    if (!req.session.admin) {
      console.error("No active admin session found");
      return res.status(HttpStatus.UNAUTHORIZED).redirect("/login");
    }

    const id = req.params.id;
    const product = await Product.findOne({ _id: id });
    const data = req.body;

    const existingProduct = await Product.findOne({
      productName: data.productName,
      _id: { $ne: id },
    });

    if (existingProduct) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({
          error: "Product with this name already exists. Try another name.",
        });
    }

    // Get existing images from the form (existingImages[])
    const existingImages = Array.isArray(data.existingImages) ? data.existingImages : (data.existingImages ? [data.existingImages] : []);

    // Process new images from file uploads
    const newImages = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        newImages.push(req.files[i].filename);
      }
    }

    // Combine existing and new images
    const updatedImages = [...existingImages, ...newImages];

    const categoryExists = await Category.findById(data.category);
    if (!categoryExists) {
      console.error("Invalid category ID:", data.category);
      return res.status(HttpStatus.BAD_REQUEST).redirect("/admin/pageerror");
    }

    const updateFields = {
      productName: data.productName,
      description: data.descriptionData,
      brand: data.brand,
      category: data.category,
      regularPrice: data.regularPrice,
      quantity: data.quantity,
      size: data.size,
      productImage: updatedImages, // Use combined images array
    };

    await Product.findByIdAndUpdate(id, updateFields, { new: true });
    res.status(200).redirect("/admin/products");
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(HttpStatus.SERVER_ERROR).redirect("/admin/pageerror");
  }
};

const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;
    const product = await Product.findByIdAndUpdate(
      productIdToServer,
      { $pull: { productImage: imageNameToServer } },
      { new: true }
    );
    const imagePath = path.join(
      __dirname,
      "..",
      "..",
      "public",
      "uploads",
      "re-image",
      imageNameToServer
    );
    if (fs.existsSync(imagePath)) {
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.error(`Error deleting image: ${imageNameToServer}`);
        } else {
          console.log(`Image ${imageNameToServer} deleted successfully`);
        }
      });
    }

    res.json({ status: true });
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

module.exports = {
  getProductAddPage,
  addProducts,
  getAllProducts,
  addProductOffer,
  removeProductOffer,
  blockProduct,
  unblockProduct,
  getEditProduct,
  editProduct,
  deleteSingleImage,
};

