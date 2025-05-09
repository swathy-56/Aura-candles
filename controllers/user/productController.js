const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Brand = require('../../models/brandSchema')

const productDetails = async (req, res) => {
  try {

    const user=req.session.user;
     const userData=await User.findOne({_id:user});
    // const userId = req.session.user;
    //const userData = await User.findById(userId)
    //const userData = userId ? await User.findById(userId) : null;
    const productId = req.query.id;
    const product = await Product.findById(productId)
      .populate("category")
      .populate("brand");

    const findCategory = product.category;
    //const categoryOffer = findCategory ?.categoryOffer || 0
    //const productOffer = product.productOffer || 0
    // const totalOffer = categoryOffer + productOffer

    const relatedProducts = await Product.find({
      category: findCategory?._id,
      _id: { $ne: productId },
    }).limit(3);

    res.render("product-details", {
      user: userData,
      product: product,
      quantity: product.quantity,
      //totalOffer : totalOffer,
      category: findCategory,
      relatedProducts: relatedProducts,
    });
  } catch (error) {
    console.error("Error for fetching product details", error);
    res.redirect("/pageNotFound");
  }
};

 



const loadshop = async (req, res) => {
  try {
      // Initialize userData as null
      //let userData ;
      //console.log("hellooo");
      const user=req.session.user;
      //let userData = userId ? await User.findById(userId) : null;
      let userData=await User.findOne({_id:user});
      
      console.log("userId:",user)
      
      // Check if user is logged in and get user data if they are
      if (req.session.user) {
          //userData = await User.findOne({ _id: req.session.user });
          userData=await User.findOne({_id:user});
          console.log("user data inside:",userData)
      }

      const query = {
          search: req.query.search || '',
          sort: req.query.sort || '',
          category: req.query.category || '',
          brand: req.query.brand || '',
          maxPrice: req.query.maxPrice || '',
          minPrice: req.query.minPrice || ''
      };

      // Base filter conditions
      const filter = {
          isBlocked: false,
          status: "Available"
      };

      // Add search filter if provided
      if (query.search) {
          filter.productName = { $regex: query.search, $options: 'i' };
      }

      
      if (query.category) {
          filter.category = query.category;
      }

      // Add brand filter if provided
      if (query.brand) {
          filter.brand = query.brand;
      }

      // Add price range filter if provided
      if (query.minPrice || query.maxPrice) {
          filter.salePrice = {};
          if (query.minPrice) filter.salePrice.$gte = parseInt(query.minPrice);
          if (query.maxPrice) filter.salePrice.$lte = parseInt(query.maxPrice);
      }

      // Sort options
      let sortOptions = {};
      switch (query.sort) {
          case 'price-asc':
              sortOptions = { salePrice: 1 };
              break;
          case 'price-desc':
              sortOptions = { salePrice: -1 };
              break;
          case 'name-asc':
              sortOptions = { productName: 1 };
              break;
          case 'name-desc':
              sortOptions = { productName: -1 };
              break;
          default:
              sortOptions = { createdAt: -1 };
      }

      // Fetch all required data
      const [products, categories, brands] = await Promise.all([
          Product.find(filter)
                 .sort(sortOptions)
                 .collation({ locale: "en", strength: 2 })
                 .populate('category')
                 .populate('brand'),
          Category.find({ isListed: true }),
          Brand.find()
      ]);

      console.log('Products:', products); // Debug log

      // Render the shop page with or without user data
      res.render('shop', {
          products,
          categories,
          brands,
          query,
          userData, 
          isLoggedIn: !!req.session.user 
      });

  } catch (error) {
      console.error('Shop page error:', error);
    
     res.render('login') 

    
   }
};




module.exports = {
  productDetails,
  loadshop

};