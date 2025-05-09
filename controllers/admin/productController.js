const Product=require('../../models/productSchema');
const Category=require('../../models/categorySchema');
const Brand=require('../../models/brandSchema');
const User=require('../../models/userSchema');
const fs=require('fs');
const path=require('path');
const sharp=require('sharp');


const getProductAddPage = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true });
        const brand = await Brand.find({ isBlocked: false });
        res.render('product-add', { cat: category, brand: brand });
    } catch (error) {
        console.error('Error in getProductAddPage:', error);
        res.redirect('/admin/pageerror');
    }
};
const addProducts = async (req, res) => {
    try {
        console.log('Request Body:', req.body); // Debug
        console.log('Files:', req.files); // Debug

        const products = req.body;
        const productExists = await Product.findOne({ productName: products.productName });

        if (productExists) {
            return res.status(400).json({ status: false, message: 'Product already exists. Please try with another name' });
        }

        const images = [];
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const originalPath = req.files[i].path;
                const resizedImagePath = path.join('public', 'uploads', 'product-images', req.files[i].filename);
                await sharp(originalPath)
                    .resize({ width: 440, height: 440 })
                    .toFile(resizedImagePath);
                images.push(req.files[i].filename);
            }
        }

        const categoryId = await Category.findOne({ name: products.category });
        if (!categoryId) {
            return res.status(400).json({ status: false, message: 'Invalid category name' });
        }

        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: products.brand,
            category: categoryId._id,
            regularPrice: parseFloat(products.regularPrice),
            salePrice: parseFloat(products.salePrice),
            quantity: parseInt(products.quantity),
            size: products.size, // Use size from the form
            color: products.color || '', // Optional, defaults to empty string
            productImage: images,
            status: "Available"
        });

        await newProduct.save();
        return res.json({ status: true, message: 'Product added successfully' });
    } catch (error) {
        console.error('Error saving product:', error);
        return res.status(500).json({ status: false, message: 'Error adding product' });
    }
};

const getAllProducts=async(req,res)=>{
    try {
        const search=req.query.search||'';
        const page=req.query.page||1;
        const limit=4;

        const productData=await Product.find({
            $or:[
                {productName:{$regex:new RegExp('.*'+search+'.*','i')}},
                {brand:{$regex:new RegExp('.*'+search+'.*','i')}},
            ],
        })
        .sort({createdAt :-1})
        .limit(limit*1)
        .skip((page-1)*limit)
        .populate('category')
        .exec();

        const count=await Product.find({
            $or:[
                {productName:{$regex:new RegExp('.*'+search+'.*','i')}},
                {brand:{$regex:new RegExp('.*'+search+'.*','i')}},
            ],
            
        }).countDocuments();

        const category=await Category.find({isListed:true});
        const brand=await Brand.find({isBlocked:false});

        if(category && brand){
            res.render('products', {
                data: productData,
                currentPage: parseInt(page), // ✅ Ensure currentPage is parsed as an integer
                totalPages: Math.ceil(count / limit), // ✅ Fix duplicate key `totalPages`
                cat: category,
                brand: brand
            });
        }else{
            res.render('page-404');
        }
        

    } catch (error) {
        res.redirect('/admin/pageerror');
    }
};


const addProductOffer = async (req, res) => {
    try {
        const { productId, percentage } = req.body;

       
        const findProduct = await Product.findOne({ _id: productId });
        const findCategory = await Category.findOne({ _id: findProduct.category });

        if (findCategory.categoryOffer > percentage) {
            return res.json({ status: false, message: 'Category offer exceeds this product offer' });
        }

        const discount = Math.floor(findProduct.regularPrice * (percentage / 100));
        findProduct.salePrice = findProduct.regularPrice - discount;
        findProduct.productOffer = parseInt(percentage);
        await findProduct.save();

        if (findCategory.categoryOffer > 0) {
            findCategory.categoryOffer = 0;
            await findCategory.save();
        }

        res.json({ status: true, message: 'Product offer added successfully' });
    } catch (error) {
        console.error('Error in addProductOffer:', error);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
};




const removeProductOffer = async (req, res) => {
    try {
        const { productId } = req.body;
        const findProduct = await Product.findOne({ _id: productId });
        if (!findProduct) {
            return res.status(404).json({ status: false, message: "Product not found" });
        }
        if (findProduct.productOffer === 0) {
            return res.json({ status: false, message: "No offer to remove" });
        }

        const findCategory = await Category.findOne({ _id: findProduct.category });
        findProduct.salePrice = findProduct.regularPrice;
        findProduct.productOffer = 0;

        if (findCategory.categoryOffer > 0) {
            const discount = Math.floor(findProduct.regularPrice * (findCategory.categoryOffer / 100));
            findProduct.salePrice -= discount;
        }

        await findProduct.save();
        res.json({ status: true, message: 'Product offer removed successfully' });
    } catch (error) {
        console.error("Error removing product offer:", error);
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};


// Block Product
const blockProduct = async (req, res) => {
    try {
        let id = req.body.id; // ✅ Get ID from request body
        await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.json({ status: true, message: 'Product blocked successfully' }); // ✅ Return JSON instead of redirect
    } catch (error) {
        console.error('Error blocking product:', error);
        res.status(500).json({ status: false, message: 'Error blocking product' }); // ✅ Handle error with JSON
    }
};

// Unblock Product
const unblockProduct = async (req, res) => {
    try {
        let id = req.body.id; // ✅ Get ID from request body
        await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.json({ status: true, message: 'Product unblocked successfully' }); // ✅ Return JSON instead of redirect
    } catch (error) {
        console.error('Error unblocking product:', error);
        res.status(500).json({ status: false, message: 'Error unblocking product' });
    }
};


const getEditProduct=async (req,res)=>{
    try {
        
        const id=req.query.id;
        const product=await Product.findOne({_id:id});
        const category=await Category.find({});
        const brand=await Brand.find({});
        res.render('edit-product',{
            product:product,
            cat:category,
            brand:brand
        })
    } catch (error) {
        res.redirect('/admin/pageerror');
    }
};


// const editProduct=async(req,res)=>{
//     try {
        
//         const id=req.params.id;
//         const product=await Product.findOne({_id:id});
//         const data=req.body;
//         const existingProduct=await Product.findOne({
//             productName:data.productName,
//             _id:{$ne:id}
//         })

//         if(existingProduct){
//             return res.status(400).json({error:'Product with this name already exists.Please try with another name'});
//         }

//         const images=[];

//         if(req.files && req.files.length>0){
//             for(let i=0;i<req.files.length;i++){
//                 images.push(req.files[i].filename);
//             }
//         }

//         const updateFields={
//             productName:data.productName,
//             description:data.descriptionData,
//             brand:data.brand,
//             category:product.category,
//             regularPrice:data.regularPrice,
//             salePrice:data.salePrice,
//             quantity:data.quantity,
//             size:data.size,
//             color:data.color

//         }

//         if (req.files.length > 0) {
//             updateFields.productImage = images; // Replace all images
//         } else {
//             updateFields.productImage = product.productImage; // Keep existing images if no new ones uploaded
//         }
//         await Product.findByIdAndUpdate(id,updateFields,{new:true});
//         res.redirect('/admin/products');
//     } catch (error) {
//         console.error(error);
//         res.redirect('/pageerror');
//     }
// }


// const editProduct = async (req, res) => {
//     try {
//         console.log("=== editProduct function triggered ==="); 
//         console.log("Session Admin:", req.session.admin); 

//         // Check for admin session instead of user
//         if (!req.session.admin) {
//             console.error("No active admin session found");
//             return res.status(401).redirect('/login');
//         }

//         const id = req.params.id;
//         const product = await Product.findOne({ _id: id });
//         const data = req.body;

//         const existingProduct = await Product.findOne({
//             productName: data.productName,
//             _id: { $ne: id }
//         });

//         if (existingProduct) {
//             return res.status(400).json({ error: 'Product with this name already exists. Try another name.' });
//         }

//         const images = [];
//         if (req.files && req.files.length > 0) {
//             for (let i = 0; i < req.files.length; i++) {
//                 images.push(req.files[i].filename);
//             }
//         }

//         const updateFields = {
//             productName: data.productName,
//             description: data.descriptionData,
//             brand: data.brand,
//             category: data.category, // Changed from product.category
//             regularPrice: data.regularPrice,
//             salePrice: data.salePrice,
//             quantity: data.quantity,
//             size: data.size,
//             productImage: req.files.length > 0 ? images : product.productImage
//         };

//         await Product.findByIdAndUpdate(id, updateFields, { new: true });
//         res.redirect('/admin/products');
//     } catch (error) {
//         console.error("Error updating product:", error);
//         res.status(500).redirect('/pageerror');
//     }
// };





const editProduct = async (req, res) => {
    console.log('=== Entering editProduct ===');
    console.log('Params ID:', req.params.id);
    console.log('Body:', req.body);
    console.log('Files:', req.files);
    try {
        console.log("=== editProduct function triggered ===");
        console.log("Session Admin:", req.session.admin);
        console.log("Session ID:", req.sessionID);
        console.log("Full Session:", req.session);

        if (!req.session.admin) {
            console.error("No active admin session found");
            return res.status(401).redirect('/login');
        }

        const id = req.params.id;
        const product = await Product.findOne({ _id: id });
        const data = req.body;

        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id }
        });

        if (existingProduct) {
            return res.status(400).json({ error: 'Product with this name already exists. Try another name.' });
        }

        const images = [];
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                images.push(req.files[i].filename);
            }
        }

        // Validate category exists
        const categoryExists = await Category.findById(data.category);
        if (!categoryExists) {
            console.error('Invalid category ID:', data.category);
            return res.status(400).redirect('/admin/pageerror');
        }

        const updateFields = {
            productName: data.productName,
            description: data.descriptionData,
            brand: data.brand,
            category: data.category, // Changed from product.category
            regularPrice: data.regularPrice,
            salePrice: data.salePrice,
            quantity: data.quantity,
            size: data.size,
            productImage: req.files.length > 0 ? images : product.productImage
        };

        await Product.findByIdAndUpdate(id, updateFields, { new: true });
        //res.redirect('/admin/products');
        res.status(200).redirect('/admin/products');
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).redirect('/admin/pageerror');
    }
};





const deleteSingleImage=async(req,res)=>{
    try {
        
        const {imageNameToServer,productIdToServer}=req.body;
        const product=await Product.findByIdAndUpdate(productIdToServer,{$pull:{productImage:imageNameToServer}}, {new :true});
        console.log('---------------------------', product)
        const imagePath=path.join(__dirname, '..', '..','public','uploads','re-image',imageNameToServer);
        if (fs.existsSync(imagePath)) {
            fs.unlink(imagePath, (err) => {
                if (err) {
                    console.error(`Error deleting image: ${imageNameToServer}`);
                } else {
                    console.log(`Image ${imageNameToServer} deleted successfully`);
                }
            });
        }
        
        res.json({status:true});
    } catch (error) {
        res.redirect('/admin/pageerror');
    }
}




module.exports={
    getProductAddPage,
    addProducts,
    getAllProducts,
    addProductOffer,
    removeProductOffer,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage
}