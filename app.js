const express=require('express');
const path=require('path');
const dotenv=require('dotenv').config();
const session=require('express-session');
const passport=require('./config/passport');
const db=require('./config/db');
const userRouter=require('./routes/userRouter');
const adminRouter=require('./routes/adminRouter');
const errorHandler = require('./middlewares/error');
const flash=require('express-flash');
const methodOverride = require('method-override');

const app=express(); 

//connect to db
db();



//Middleware for parsing JSON and URL encoded data
app.use(express.json());
app.use(express.urlencoded({extended:true}));

//Session Middleware
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))

//Flash message middleware
app.use(flash());

//Passport middleware for authentication
app.use(passport.initialize());
app.use(passport.session());

//Middleware to disable caching
app.use((req,res,next)=>{
    res.set('cache-control','no-store')
    next();
});

//Set view engine and views directory
app.set('view engine','ejs');
app.set('views',[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
//app.use(express.static(path.join(__dirname,'public')));
app.use( express.static(path.join(__dirname, 'public')));

//middleware to store user in session
app.use((req,res,next)=>{
    res.locals.user=req.session.user||null;
    next();
})

// Enable method override for PATCH/DELETE
//app.use(methodOverride('_method'));
app.use(methodOverride((req, res) => {
    if (req.body && req.body._method) {
        console.log(`Overriding method: ${req.method} -> ${req.body._method}`);
        return req.body._method;
    }
}));

// Add this middleware before your route
app.use((req, res, next) => {
    console.log('Session before route:', req.session);
    next();
});

//Routes
app.use('/',userRouter);
app.use('/admin',adminRouter);

// Error-handling middleware
app.use(errorHandler);

app.use((req, res, next) => {
    res.status(404).render('page-404');
});

app.use((req, res, next) => {
    res.status(404).render('admin/pageerror');
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>{
    console.log(`server is running at ${PORT}`)
}); 


module.exports=app;