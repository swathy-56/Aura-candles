const Brand = require('../../models/brandSchema');
const Product = require('../../models/productSchema');
const { HttpStatus } = require("../../shared/constants");

const getBrandPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const brandData = await Brand.find({})
            .sort({ createdAt: -1 }) 
            .skip(skip)
            .limit(limit);

        const totalBrands = await Brand.countDocuments();
        const totalPages = Math.ceil(totalBrands / limit);

        res.render('brands', {
            data: brandData,
            currentPage: page, 
            totalPages: totalPages,
            totalBrands: totalBrands
        });
    } catch (error) {
        console.error('Error fetching brands:', error);
        req.flash('error', 'Failed to load brands');
        res.redirect('/admin/pageerror');
    }
};

const addBrand = async (req, res) => {
    try {
        const brandName = req.body.name?.trim();
        if (!brandName || brandName.length < 2 || brandName.length > 50) {
            req.flash('error', 'Brand name must be 2-50 characters long');
            return res.redirect('/admin/brands');
        }

        // Check for duplicate brand (case-insensitive)
        const findBrand = await Brand.findOne({ brandName: { $regex: `^${brandName}$`, $options: 'i' } });
        if (findBrand) {
            req.flash('error', 'Brand name already exists');
            return res.redirect('/admin/brands');
        }

        if (!req.file) {
            req.flash('error', 'Brand image is required');
            return res.redirect('/admin/brands');
        }

        const image = req.file.filename;
        const newBrand = new Brand({
            brandName: brandName,
            brandImage: [image] // Store as array to match template
        });

        await newBrand.save();
        req.flash('success', 'Brand added successfully');
        res.redirect('/admin/brands');
    } catch (error) {
        console.error('Error adding brand:', error);
        req.flash('error', 'Failed to add brand');
        res.redirect('/admin/pageerror');
    }
};

const blockBrand = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Brand ID is required' });
        }

        const brand = await Brand.findByIdAndUpdate(id, { isBlocked: true }, { new: true });
        if (!brand) {
            return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Brand not found' });
        }

        res.status(200).json({ success: true, message: 'Brand blocked successfully' });
    } catch (error) {
        console.error('Error blocking brand:', error);
        res.status(HttpStatus.SERVER_ERROR).json({ success: false, message: 'Error blocking brand' });
    }
};

const unBlockBrand = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Brand ID is required' });
        }

        const brand = await Brand.findByIdAndUpdate(id, { isBlocked: false }, { new: true });
        if (!brand) {
            return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Brand not found' });
        }

        res.status(200).json({ success: true, message: 'Brand unblocked successfully' });
    } catch (error) {
        console.error('Error unblocking brand:', error);
        res.status(HttpStatus.SERVER_ERROR).json({ success: false, message: 'Error unblocking brand' });
    }
};

const deleteBrand = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Brand ID is required' });
        }

        const brand = await Brand.findByIdAndDelete(id);
        if (!brand) {
            return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Brand not found' });
        }

        res.status(200).json({ success: true, message: 'Brand deleted successfully' });
    } catch (error) {
        console.error('Error deleting brand:', error);
        res.status(HttpStatus.SERVER_ERROR).json({ success: false, message: 'Error deleting brand' });
    }
};

module.exports = {
    getBrandPage,
    addBrand,
    blockBrand,
    unBlockBrand,
    deleteBrand
};