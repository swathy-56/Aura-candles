const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Brand = require("../../models/brandSchema");

const productDetails = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });

    const productId = req.query.id;
    const product = await Product.findById(productId)
      .populate("category").lean()

    const categoryOffer = product.category.categoryOffer || 0
    const productOffer = product.productOffer || 0
    const totalOffer = Math.max(categoryOffer, productOffer)

    const updateProduct = {
      ...product,
      finalPrice: product.regularPrice - (product.regularPrice * totalOffer / 100)
    }

    console.log('heloooooooooooooooooooooooooooooo',updateProduct)

    const relatedProducts = await Product.find({
      category: product.category?._id,
      _id: { $ne: productId },
    }).limit(3);

    res.render("product-details", {
      user: userData,
      product: updateProduct,
      quantity: product.quantity,
      category: product.category,
      relatedProducts: relatedProducts,
    });
  } catch (error) {
    console.error("Error for fetching product details", error);
    res.redirect("/pageNotFound");
  }
};

const loadshop = async (req, res) => {
  try {
    const user = req.session.user;
    let userData = await User.findOne({ _id: user });
    console.log("userId:", user);

    if (req.session.user) {
      userData = await User.findOne({ _id: user });
    }

    const escapeRegex = (text) => {
      return text.replace(/[.*+?^=!:${}()|\[\]\/\\]/g, "\\$&");
    };

    const query = {
      search: req.query.search || "",
      sort: req.query.sort || "",
      category: req.query.category || "",
      brand: req.query.brand || "",
      maxPrice: req.query.maxPrice || "",
      minPrice: req.query.minPrice || "",
    };

    // Base filter conditions
    const filter = {
      isBlocked: false,
      status: "Available",
    };

    // Add search filter if provided
    if (query.search) {
      const escapedSearch = escapeRegex(query.search);
      filter.productName = { $regex: escapedSearch, $options: "i" };
    }

    // Add category filter if provided
    if (query.category) {
      filter.category = query.category;
    }

    // Add brand filter if provided and ensure the brand is not blocked
    if (query.brand) {
      // Verify that the brand is not blocked
      const brand = await Brand.findOne({ _id: query.brand, isBlocked: false });
      console.log("BRANDD:", brand);
      if (brand) {
        filter.brand = brand.brandName; // Use brandName for filtering since Product.brand is a String
      } else {
        // If the brand is blocked or doesn't exist, return no products
        filter.brand = null;
      }
    }

    // Add price range filter if provided
    if (query.minPrice || query.maxPrice) {
      filter.regularPrice = {};
      if (query.minPrice) filter.regularPrice.$gte = parseInt(query.minPrice);
      if (query.maxPrice) filter.regularPrice.$lte = parseInt(query.maxPrice);
    }

    // Log the final filter object for debugging
    console.log("Final filter:", JSON.stringify(filter, null, 2));

    // Sort options
    let sortOptions = {};
    switch (query.sort) {
      case "price-asc":
        sortOptions = { regularPrice: 1 };
        break;
      case "price-desc":
        sortOptions = { regularPrice: -1 };
        break;
      case "name-asc":
        sortOptions = { productName: 1 };
        break;
      case "name-desc":
        sortOptions = { productName: -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    // Get IDs of listed categories
    const listedCategoryIds = await Category.find({ isListed: true }).distinct(
      "_id"
    );

    // Handle category filtering
    if (
      query.category &&
      listedCategoryIds.map((id) => id.toString()).includes(query.category)
    ) {
      filter.category = query.category;
    } else {
      filter.category = { $in: listedCategoryIds };
    }

    // Fetch all required data
    const [products, categories, brands] = await Promise.all([
      Product.find(filter)
        .populate("category") // Only populate category, as brand is a String
        .sort(sortOptions)
        .collation({ locale: "en", strength: 2 }),
      Category.find({ isListed: true }),
      Brand.find({ isBlocked: false }), // Only fetch non-blocked brands for the sidebar
    ]);

    // Log the number of products found
    console.log("Products found:", products.length);
    console.log("Products:", products.map(p => ({
      _id: p._id,
      productName: p.productName,
      brand: p.brand
    })));

    const searchTerm = query.search?.toString().toLowerCase() || "";

    if (searchTerm) {
      products.sort((a, b) => {
        const aName = typeof a.productName === "string" ? a.productName.toLowerCase() : "";
        const bName = typeof b.productName === "string" ? b.productName.toLowerCase() : "";

        const aStarts = aName.startsWith(searchTerm) ? 0 : 1;
        const bStarts = bName.startsWith(searchTerm) ? 0 : 1;

        if (aStarts !== bStarts) return aStarts - bStarts;

        return aName.localeCompare(bName);
      });
    }

    // Render the shop page with or without user data
    res.render("shop", {
      products,
      categories,
      brands,
      query,
      userData,
      isLoggedIn: !!req.session.user,
    });
  } catch (error) {
    console.error("Shop page error:", error);
    res.render("login");
  }
};

module.exports = {
  productDetails,
  loadshop,
};