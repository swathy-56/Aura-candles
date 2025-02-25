const User=require('../../models/userSchema');



const customerInfo = async (req, res) => {
    try {
        console.log("Fetching customers...");

        const customers = await User.find(); // Fetch all customers
        console.log("Customers fetched:", customers); // Log fetched data

        const currentPage = parseInt(req.query.page) || 1;
        const pageSize = 10;
        const totalCustomers = await User.countDocuments();
        const totalPages = Math.ceil(totalCustomers / pageSize);

        // ✅ Log before rendering to check if `customers` exists
        console.log("Data sent to EJS:", { data: customers, totalPages, currentPage });

        res.render("customers", {
            data: customers,  // Ensure this is included
            totalPages,
            currentPage
        });

    } catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).send("Server Error");
        res.redirect('/pageerror');
    }
};


const customerBlocked=async(req,res)=>{
    try {
        
        let id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect('/admin/users')
    } catch (error) {
        res.redirect('/pageerror');
    }
};



const customerunBlocked=async(req,res)=>{
    try {
        
       let id=req.query.id;
       await User.updateOne({_id:id},{$set:{isBlocked:false}});
       res.redirect('/admin/users')
    
    } catch (error) {
        res.redirect('/pageerror');
    }
}




module.exports={
    customerInfo,
    customerBlocked,
    customerunBlocked
}