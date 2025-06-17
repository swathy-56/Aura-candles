const Category=require('../../models/categorySchema');
const Product=require('../../models/productSchema');
const { HttpStatus } = require("../../shared/constants");


const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const search = req.query.search || ''; 

        
        let query = {};
        if (search) {
            query = {
                $or: [
                    { name: { $regex: search, $options: 'i' } }, 
                    { description: { $regex: search, $options: 'i' } } 
                ]
            };
        }

        
        const categoryData = await Category.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        
        const totalCategories = await Category.countDocuments(query);
        const totalPages = Math.ceil(totalCategories / limit);

        res.render('category', {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
            search: search 
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/pageerror');
    }
};

const addCategory=async(req,res)=>{
    
    try {
        const{name,description}=req.body;

       
        if (!name || !name.trim()) {
            return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Category name is required' });
        }
        
        const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existingCategory) {
            return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Category already exists' });
        }
        
        const newCategory=new Category({
          name:name.trim(),
          description:description?.trim()||''
        })
        await newCategory.save();
        return res.json({message:'Category added successfully'});
    } catch (error) {
        return res.status(HttpStatus.SERVER_ERROR).json({error:'Internal server Error'});
        
    }
};


const addCategoryOffer = async (req, res) => {
    try {
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(HttpStatus.NOT_FOUND).json({ status: false, message: 'Category not found' });
        }
        
        await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });
        res.json({ status: true, message: 'Category offer applied successfully' });
    } catch (error) {
        console.error('Error in addCategoryOffer:', error);
        res.status(HttpStatus.SERVER_ERROR).json({ status: false, message: 'Internal Server Error' });
    }
};

const removeCategoryOffer = async (req, res) => {
    try {
        const {categoryId} = req.body;
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(HttpStatus.NOT_FOUND).json({ status: false, message: 'Category not found' });
        }
       
        category.categoryOffer = 0;
        await category.save();
        res.json({ status: true, message: 'Category offer removed successfully' });
    } catch (error) {
        console.error('Error in removeCategoryOffer:', error);
        res.status(HttpStatus.SERVER_ERROR).json({ status: false, message: 'Internal Server Error' });
    }
};


const getListCategory = async (req, res) => {
    try {
        const { id } = req.body; 

        await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        res.status(200).json({ success: true, message: 'Category unlisted successfully' });
    } catch (error) {
        console.error('Error in getListCategory:', error);
        res.status(HttpStatus.SERVER_ERROR).json({ success: false, message: 'Error unlisting category' });
    }
};

const getUnlistCategory = async (req, res) => {
    try {
        const { id } = req.body;

        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.status(200).json({ success: true, message: 'Category listed successfully' });
    } catch (error) {
        console.error('Error in getUnlistCategory:', error);
        res.status(HttpStatus.SERVER_ERROR).json({ success: false, message: 'Error listing category' });
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


const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { categoryName, description } = req.body;

    // Server-side validation
    if (!categoryName || !categoryName.trim()) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: "Category name is required" });
    }
    if (categoryName.length < 3) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: "Category name must be at least 3 characters long" });
    }
    if (categoryName.length > 50) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: "Category name cannot exceed 50 characters" });
    }
    if (!description || !description.trim()) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: "Description is required" });
    }
    if (description.length < 10) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: "Description must be at least 10 characters long" });
    }

    // Check for duplicate category name (case-insensitive)
    const existingCategory = await Category.findOne({
      name: { $regex: `^${categoryName}$`, $options: "i" }, // Case-insensitive match
      _id: { $ne: id }, // Exclude the current category
    });

    if (existingCategory) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: "Category name already exists" });
    }

    const updateCategory = await Category.findByIdAndUpdate(
      id,
      {
        name: categoryName.trim(),
        description: description.trim(),
      },
      { new: true }
    );

    if (updateCategory) {
      res.status(200).json({ success: true, message: "Category updated successfully" });
    } else {
      res.status(HttpStatus.NOT_FOUND).json({ error: "Category not found" });
    }
  } catch (error) {
    console.error('Error in editCategory:', error);
    // Provide specific error messages based on the type of error
    if (error.name === 'ValidationError') {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: "Invalid category data: " + error.message });
    }
    if (error.name === 'CastError') {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: "Invalid category ID" });
    }
    res.status(HttpStatus.SERVER_ERROR).json({ error: "An unexpected error occurred on the server" });
  }
};



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