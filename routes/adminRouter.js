
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');
const brandController = require('../controllers/admin/brandController');
const productController = require('../controllers/admin/productController');
const orderController = require('../controllers/admin/orderController');
const couponController = require('../controllers/admin/couponController');
const reportController = require('../controllers/admin/reportController');
const { adminAuth } = require('../middlewares/auth');
const multer = require('multer');
const storage = require('../helpers/multer');
const uploads = multer({ storage: storage });

// Error Management
router.get('/pageerror', adminController.pageerror);

// Login Management
router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);
router.get('/home', adminController.loadDashboard);
router.get('/dashboard-data', adminController.getDashboardData);
router.get('/generate-ledger', adminController.downloadReport);
router.post('/logout', adminController.logout);  

// Customer Management
router.get('/users', adminAuth, customerController.customerInfo);
router.patch('/blockCustomer', adminAuth, customerController.customerBlocked);    
router.patch('/unblockCustomer', adminAuth, customerController.customerUnBlocked); 

// Category Management
router.get('/category', adminAuth, categoryController.categoryInfo);
router.post('/addCategory', adminAuth, categoryController.addCategory);
router.post('/addCategoryOffer', adminAuth, categoryController.addCategoryOffer);
router.delete('/removeCategoryOffer', adminAuth, categoryController.removeCategoryOffer); 
router.patch('/listCategory', adminAuth, categoryController.getListCategory);     
router.patch('/unlistCategory', adminAuth, categoryController.getUnlistCategory); 
router.get('/editCategory', adminAuth, categoryController.getEditCategory);
router.put('/editCategory/:id', adminAuth, categoryController.editCategory);      

// Brand Management
router.get('/brands', adminAuth, brandController.getBrandPage);
router.post('/addBrand', adminAuth, uploads.single('image'), brandController.addBrand);
router.patch('/blockBrand', adminAuth, brandController.blockBrand);              
router.patch('/unBlockBrand', adminAuth, brandController.unBlockBrand);          
router.delete('/deleteBrand', adminAuth, brandController.deleteBrand);           

// Product Management
router.get('/addProducts', adminAuth, productController.getProductAddPage);
router.post('/addProducts', adminAuth, uploads.array('images', 4), productController.addProducts);
router.get('/products', adminAuth, productController.getAllProducts);
router.post('/addProductOffer', adminAuth, productController.addProductOffer);
router.delete('/removeProductOffer', adminAuth, productController.removeProductOffer); 
router.patch('/blockProduct', adminAuth, productController.blockProduct);        
router.patch('/unblockProduct', adminAuth, productController.unblockProduct);    
router.get('/editProduct', adminAuth, productController.getEditProduct);
router.post('/editProduct/:id',  uploads.array('images', 4), productController.editProduct); 
router.delete('/deleteImage', adminAuth, productController.deleteSingleImage);   

// Order Management
router.get('/orderlist', adminAuth, orderController.orderList);
router.get('/order-details', adminAuth, orderController.orderDetails);
router.patch('/update-item-status', orderController.updateItemStatus);           
router.patch('/update-status', adminAuth, orderController.updateOrderStatus);    
router.get('/returns', adminAuth, orderController.getReturnRequests);
router.patch('/process-return', adminAuth, orderController.processReturn);       

// Coupon Management
router.get('/coupons', adminAuth, couponController.getCouponsPage);
router.post('/add-coupon', adminAuth, couponController.addCoupon);
router.delete('/delete-coupon', adminAuth, couponController.deleteCoupon);       

// Sales Report
router.get('/sales-report', adminAuth, reportController.getSalesReportPage);
router.post('/generate-sales-report', adminAuth, reportController.generateSalesReport);
router.post('/download-sales-report', adminAuth, reportController.downloadSalesReport);

module.exports = router;