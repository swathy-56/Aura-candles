// controllers/admin/couponController.js
const Coupon = require('../../models/couponSchema');

const getCouponsPage = async (req, res) => {
    try {
        const coupons = await Coupon.find();
        res.render('coupons', { coupons });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

const addCoupon = async (req, res) => {
    try {
        const { code, discountPercentage,maxDiscount, minimumAmount, expiryDate } = req.body;
        
        const existingCoupon = await Coupon.findOne({ code});
        if (existingCoupon) {
            return res.json({ success: false, message: 'Coupon code already exists' });
        }

        const checking=await Coupon.findOne({discountPercentage,maxDiscount})
        if(checking){
            
        }


        const coupon = new Coupon({
            code: code.toUpperCase(),
            discountPercentage,
            minimumAmount,
            maxDiscount,
            expiryDate,
            isActive: true
        });

        await coupon.save();
        res.json({ success: true, message: 'Coupon added successfully' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: 'Error adding coupon' });
    }
};

const deleteCoupon = async (req, res) => {
    try {
        const { couponId } = req.body;
        await Coupon.findByIdAndDelete(couponId);
        res.json({ success: true, message: 'Coupon deleted successfully' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: 'Error deleting coupon' });
    }
};

module.exports={

    getCouponsPage,
    addCoupon,
    deleteCoupon
}