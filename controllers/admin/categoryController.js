const Category=require('../../models/categorySchema');
const Product=require('../../models/productSchema');




// const categoryInfo=async(req,res)=>{
//     try {
//         const page=parseInt(req.query.page)||1;
//         const limit=4;
//         const skip=(page-1)*limit;

//         const categoryData=await Category.find({})
//         .sort({createdAt:-1})
//         .skip(skip)
//         .limit(limit);

//         const totalCategories=await Category.countDocuments();
//         const totalPages=Math.ceil(totalCategories/limit);
//         res.render('category',{
//             cat:categoryData,
//             currentPage:page,
//             totalPages:totalPages,
//             totalCategories:totalCategories
//         });
//     } catch (error) {
//         console.error(error);
//         res.redirect('/pageerror');
//     }
// };


const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const search = req.query.search || ''; // Get search term, default to empty string

        // Define the query object
        let query = {};
        if (search) {
            query = {
                $or: [
                    { name: { $regex: search, $options: 'i' } }, // Case-insensitive search on name
                    { description: { $regex: search, $options: 'i' } } // Case-insensitive search on description
                ]
            };
        }

        // Fetch filtered categories
        const categoryData = await Category.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Count total matching documents for pagination
        const totalCategories = await Category.countDocuments(query);
        const totalPages = Math.ceil(totalCategories / limit);

        res.render('category', {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
            search: search // Pass search term to retain it in the form
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/pageerror');
    }
};

const addCategory=async(req,res)=>{
    const{name,description}=req.body;
    try {
        
        const existingCategory=await Category.findOne({name});
        if(existingCategory){
            return res.status(400).json({error:'Category already exists'})
        }
        const newCategory=new Category({
            name,
            description
        })
        await newCategory.save();
        return res.json({message:'Category added successfully'});
    } catch (error) {
        return res.status(500).json({error:'Internal server Error'});
        
    }
};


const addCategoryOffer = async (req, res) => {
    try {
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ status: false, message: 'Category not found' });
        }
        const products = await Product.find({ category: category._id });
        const hasProductOffer = products.some((product) => product.productOffer > percentage);
        if (hasProductOffer) {
            return res.json({ status: false, message: 'Products in this category already have a higher product offer' });
        }

        await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });
        for (const product of products) {
            product.productOffer = 0; // Clear any existing product offer
            product.salePrice = product.regularPrice - Math.floor(product.regularPrice * (percentage / 100));
            await product.save();
        }
        res.json({ status: true, message: 'Category offer applied successfully' });
    } catch (error) {
        console.error('Error in addCategoryOffer:', error);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
};

const removeCategoryOffer = async (req, res) => {
    try {
        const {categoryId} = req.body;
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ status: false, message: 'Category not found' });
        }
        const percentage = category.categoryOffer;
        const products = await Product.find({ category: category._id });

        if (products.length > 0) {
            for (const product of products) {
                product.salePrice = product.regularPrice; // Reset to original price
                product.productOffer = 0; // Ensure no product offer remains
                await product.save();
            }
        }
        category.categoryOffer = 0;
        await category.save();
        res.json({ status: true, message: 'Category offer removed successfully' });
    } catch (error) {
        console.error('Error in removeCategoryOffer:', error);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
};


const getListCategory = async (req, res) => {
    try {
        const { id } = req.body; // ✅ Get from req.body

        await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        res.status(200).json({ success: true, message: 'Category unlisted successfully' });
    } catch (error) {
        console.error('Error in getListCategory:', error);
        res.status(500).json({ success: false, message: 'Error unlisting category' });
    }
};

const getUnlistCategory = async (req, res) => {
    try {
        const { id } = req.body; // ✅ Get from req.body

        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.status(200).json({ success: true, message: 'Category listed successfully' });
    } catch (error) {
        console.error('Error in getUnlistCategory:', error);
        res.status(500).json({ success: false, message: 'Error listing category' });
    }
};



const getEditCategory=async(req,res)=>{
    try {
        
        const id=req.query.id;
        const category=await Category.findOne({_id:id});
        res.render('edit-category',{category:category});
    } catch (error) {
        res.redirect('/admin/pageerror');
    }
}


const editCategory=async(req,res)=>{
    try {
        
        const id=req.params.id;
        const{categoryName,description}=req.body;
        const existingCategory=await Category.findOne({name:categoryName,_id: { $ne: id }});

        if(existingCategory){
            return res.status(400).json({error:'Category exists,Please choose another name'})
        }

        const updateCategory=await Category.findByIdAndUpdate(id,{
            name:categoryName,
            description:description,
        },{new:true});

        if(updateCategory){
            res.status(200).json({ success: true, message: 'Category updated successfully' });
        }else{
            res.status(404).json({error:'Category not found'});
        }
    } catch (error) {
        res.status(500).json({error:'Internal Server Error'});
    }
}



module.exports={
    categoryInfo,
    addCategory,
    addCategoryOffer,
    removeCategoryOffer,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory
}