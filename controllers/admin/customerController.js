const User=require('../../models/userSchema');
const { HttpStatus } = require("../../shared/constants");



const customerInfo = async (req, res) => {
    try {
        const searchQuery = req.query.search || '';
        let query = {};
        if (searchQuery) {
            query = {
                $or: [
                    { name: { $regex: searchQuery, $options: 'i' } }, // Case-insensitive search
                    { email: { $regex: searchQuery, $options: 'i' } },
                    { phone: { $regex: searchQuery, $options: 'i' } }
                ]
            };
        }

        const currentPage = parseInt(req.query.page) || 1;
        const pageSize = 10;
        const totalCustomers = await User.countDocuments(query);
        const totalPages = Math.ceil(totalCustomers / pageSize);

        const customers = await User.find(query)
            .sort({ creation: -1 }) // Sort by creation date, descending (latest first)
            .skip((currentPage - 1) * pageSize)
            .limit(pageSize);

        res.render("customers", {
            data: customers,
            totalPages,
            currentPage,
            searchQuery // Pass searchQuery to retain it in the form
        });
    } catch (error) {
        console.error("Error fetching customers:", error);
        res.status(HttpStatus.SERVER_ERROR).send("Server Error");
        res.redirect('/admin/pageerror');
    }
};

const customerBlocked = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id || id.length !== 24) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Invalid customer ID' });
        }

        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        return res.status(200).json({ success: true, message: 'Customer blocked successfully' }); // ✅ Correct response
    } catch (error) {
        console.error('Error blocking customer:', error);
        return res.status(HttpStatus.SERVER_ERROR).json({ success: false, message: 'Error blocking customer' });
    }
};

const customerUnBlocked = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id || id.length !== 24) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Invalid customer ID' });
        }

        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        return res.status(200).json({ success: true, message: 'Customer unblocked successfully' }); // ✅ Correct response
    } catch (error) {
        console.error('Error unblocking customer:', error);
        return res.status(HttpStatus.SERVER_ERROR).json({ success: false, message: 'Error unblocking customer' });
    }
};





module.exports={
    customerInfo,
    customerBlocked,
    customerUnBlocked
}