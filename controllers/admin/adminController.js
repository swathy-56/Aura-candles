const User=require('../../models/userSchema');
const mongoose=require('mongoose');
const bcrypt=require('bcrypt');




const pageerror=async(req,res)=>{
    res.render('pageerror');
}

const loadLogin=(req,res)=>{
    try {
        
        if(req.session.admin){
            return res.render('admin/admin-login');
        }
        res.render('admin-login',{message:null})
    } catch (error) {
         console.error(erro)
         console.log("error in load login")
    }
   
}

// const login= async(req,res)=>{
//     try {
//         const {email,password}=req.body;
//         const admin=await User.findOne({email,isAdmin:true});

//         if(admin){

//             const passwordMatch=bcrypt.compare(password.admin.password);
//             if(passwordMatch){
//                 req.session.admin=true;
//                 return res.redirect('/admin');
//             }else{
//                 return res.redirect('/login');
//             }
//         }
//     } catch (error) {
        
//         console.log('login error',error);
//         return res.redirect('/pageerror');
//     }
// };

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await User.findOne({ email, isAdmin: true });
        if (!admin) {
            return res.status(400).json({ message: "Invalid credentials" }); // 🔹 Generic error message
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);
        if (!passwordMatch) {
            return res.status(400).json({ message: "Invalid credentials" }); // 🔹 Generic error message
        }

        req.session.admin = admin; // 🔹 Store admin in session

        res.status(200).json({
            message: "Login successful",
            redirectUrl: "/admin/home", // 🔹 Send redirect URL to frontend
        });
    } catch (error) {
        console.error("Error in admin login function", error);
        res.status(500).json({ message: "Internal Server Error" }); // 🔹 Consistent JSON response
    }
};



const loadDashboard=async(req,res)=>{
    try {
        res.render("dashboard")
    } catch (error) {
       console.error(error) 
       console.log("error in load dashbord function")
    }
};


const logout=async(req,res)=>{
    try {
        
        req.session.destroy(err=>{
            if(err){
                console.log('Error destroying session',err);
                return res.redirect('/pageerror')
            }
            res.redirect('/admin/login');
        })
    } catch (error) {
        
        console.log(('unexpected error during logout',error));
        res.redirect('/pageerror')
    }
}
 


module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout
 }