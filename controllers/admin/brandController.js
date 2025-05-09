const Brand=require('../../models/brandSchema');
const Product=require('../../models/productSchema');

const getBrandPage=async(req,res)=>{
    try {
        const page=parseInt(req.query.page)||1;
        const limit=4;
        const skip=(page-1)*limit;
        const brandData=await Brand.find({}).sort({createdAt:-1}).skip(skip).limit(limit);
        const totalBrands=await Brand.countDocuments();
        const totalPages=Math.ceil(totalBrands/limit);
        const reverseBrand=brandData.reverse();
        res.render('brands',{
            data:reverseBrand,
            currentPage:page,
            totalPages:totalPages,
            totalBrands:totalBrands
        })
    } catch (error) {
        res.redirect('/admin/pageerror');
    }


};


const addBrand=async(req,res)=>{
    try {
        const brand=req.body.name;
        const findBrand=await Brand.findOne({brand});
        if(!findBrand){
            const image=req.file.filename;
            const newBrand=new Brand({
                brandName:brand,
                brandImage:image
            })
            await newBrand.save();
            res.redirect('/admin/brands');
        }
    } catch (error) {
        res.redirect('/admin/pageerror');
    }
};


const blockBrand = async (req, res) => {
    try {
        const { id } = req.body; // ✅ Get from req.body
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.status(200).json({ success: true, message: 'Brand blocked successfully' });
    } catch (error) {
        console.error('Error blocking brand:', error);
        res.status(500).json({ success: false, message: 'Error blocking brand' });
    }
};

const unBlockBrand = async (req, res) => {
    try {
        const { id } = req.body; // ✅ Get from req.body
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.status(200).json({ success: true, message: 'Brand unblocked successfully' });
    } catch (error) {
        console.error('Error unblocking brand:', error);
        res.status(500).json({ success: false, message: 'Error unblocking brand' });
    }
};



const deleteBrand = async (req, res) => {
    try {
        const { id } = req.body; // ✅ Get from req.body
        if (!id) {
            return res.status(400).json({ success: false, message: 'Invalid brand ID' });
        }

        await Brand.deleteOne({ _id: id });
        res.status(200).json({ success: true, message: 'Brand deleted successfully' });
    } catch (error) {
        console.error('Error deleting brand:', error);
        res.status(500).json({ success: false, message: 'Error deleting brand' });
    }
};



module.exports={
    getBrandPage,
    addBrand,
    blockBrand,
    unBlockBrand,
    deleteBrand
}