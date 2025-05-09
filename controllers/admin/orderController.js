const Order=require('../../models/orderSchema');
const User=require('../../models/userSchema');
const Product=require('../../models/productSchema');

// const orderList=async(req,res)=>{
//     try {
//         const {search,status,page=1,limit=10}=req.query;
//         const query={};

//         if(search){
//             query.$or[
//                 {orderId:{$regex:search,$options:'i'}},
//                 {'userId.name':{$regex:search,$options:'i'}}
//             ]
//         }
//         if(status)query.status=status;

//         const total=await Order.countDocuments(query);
//         const orders=await Order.find(query)
//         .populate('userId','name email')
//         .populate('orderedItems.product','productName salePrice')
//         .sort({createdOn:-1})
//         .skip((page-1)*limit)
//         .limit(parseInt(limit));

//         res.render('orderlist',{
//             orders,
//             search:search||'',
//             status:status||'',
//             currentPage:parseInt(page),
//             totalPages:Math.ceil(total/limit)
//         });
//     } catch (error) {
//         console.error('Error fetching Orders',error);
//         res.redirect('/admin/pageerror');

//     }
// };

const orderList = async (req, res) => {
    try {
        const { search, status, page = 1, limit = 10 } = req.query;
        let matchQuery = {};

        if (status) matchQuery.status = status;

        const pipeline = [
            // Match initial conditions (e.g., status)
            { $match: matchQuery },
            // Populate userId
            {
                $lookup: {
                    from: 'users', // The collection name for User model
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userId'
                }
            },
            { $unwind: '$userId' }, // Unwind the array created by $lookup
            // Populate orderedItems.product
            {
                $lookup: {
                    from: 'products', // The collection name for Product model
                    localField: 'orderedItems.product',
                    foreignField: '_id',
                    as: 'orderedItems.product'
                }
            }
        ];

        // Add search conditions
        if (search) {
            pipeline.push({
                $match: {
                    $or: [
                        { orderId: { $regex: search, $options: 'i' } }, // Assuming orderId is a string field
                        { 'userId.name': { $regex: search, $options: 'i' } }
                    ]
                }
            });
        }

        // Sort, skip, and limit
        pipeline.push(
            { $sort: { createdOn: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: parseInt(limit) }
        );

        const orders = await Order.aggregate(pipeline).exec();

        // Get total count separately for pagination
        const countPipeline = [...pipeline];
        countPipeline.splice(-2, 2); // Remove sort, skip, and limit for counting
        countPipeline.push({ $count: 'total' });
        const countResult = await Order.aggregate(countPipeline).exec();
        const total = countResult.length > 0 ? countResult[0].total : 0;

        res.render('orderlist', {
            orders,
            search: search || '',
            status: status || '',
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error fetching Orders:', error);
        res.render('orderlist', {
            orders: [],
            search: req.query.search || '',
            status: req.query.status || '',
            currentPage: parseInt(req.query.page) || 1,
            totalPages: 1,
            error: 'An error occurred while fetching orders. Please try again.'
        });
    }
};
const orderDetails=async(req,res)=>{
    try {
        console.log('Fetching updated order details...');
        const order=await Order.findById(req.query.orderId)
        .populate('userId','name email')
        .populate('orderedItems.product','productName salePrice')
        .populate('address');

        
console.log('Fetched Order:', order);

        if(!order)return res.status(404).send('Order not found');
        console.log('Passing Order to EJS:', order);
        res.render('order-details',{order});
    } catch (error) {
        console.error('Error fetching order details',error);
        res.redirect('/admin/pageerror');
    }
};

const updateItemStatus = async (req, res) => {
    try {
        const { orderId, productId, status } = req.body;
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid Status' });
        }

        const order = await Order.findById(orderId).populate('orderedItems.product');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const item = order.orderedItems.find(item => item.product._id.toString() === productId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Product not found in order' });
        }

        // Prevent updating status if the item is in a return-related state
        if (item.status === 'Return Request' || item.status === 'Returned') {
            return res.status(400).json({ success: false, message: 'Cannot update status of an item with a return request or returned status' });
        }

        // Update the item's status
        item.status = status;

        // If the item is cancelled, update the product quantity
        if (status === 'Cancelled') {
            await Product.findByIdAndUpdate(item.product._id, {
                $inc: { quantity: item.quantity }
            });
        }

        // Update the order-level status based on the items' statuses
        const allItemsDelivered = order.orderedItems.every(item => item.status === 'Delivered');
        const allItemsCancelled = order.orderedItems.every(item => item.status === 'Cancelled');
        const anyItemReturnRequested = order.orderedItems.some(item => item.status === 'Return Request');
        const allItemsReturned = order.orderedItems.every(item => item.status === 'Returned');

        if (allItemsDelivered) {
            order.status = 'Delivered';
        } else if (allItemsCancelled) {
            order.status = 'Cancelled';
        } else if (allItemsReturned) {
            order.status = 'Returned';
        } else if (anyItemReturnRequested) {
            order.status = 'Return Request';
        } else {
            // Determine the "earliest" status among items (excluding cancelled/returned items)
            const activeStatuses = order.orderedItems
                .filter(item => !['Cancelled', 'Return Request', 'Returned'].includes(item.status))
                .map(item => item.status);
            const statusPriority = ['Pending', 'Processing', 'Shipped', 'Delivered'];
            order.status = activeStatuses.length > 0
                ? statusPriority[Math.min(...activeStatuses.map(s => statusPriority.indexOf(s)))]
                : 'Cancelled'; // Fallback if all items are cancelled/returned
        }

        await order.save();

        res.json({ success: true, message: 'Item status updated successfully' });
    } catch (error) {
        console.error('Error updating item status:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid Status' });
        }

        const order = await Order.findByIdAndUpdate(
            orderId,
            { status },
            { new: true }
        ).populate('orderedItems.product');
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        if (status === 'Cancelled') {
            for (const item of order.orderedItems) { // Fixed: Use order.orderedItems
                await Product.findByIdAndUpdate(
                    item.product._id,
                    { $inc: { quantity: item.quantity } }
                );
            }
        }
        res.json({ success: true, message: 'Status updated' });
    } catch (error) {
        console.error('Error updating status:', error); // Improved logging
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// const getReturnRequests = async (req, res) => {
//     try {
//         const returns = await Order.find({ status: 'Return Request' })
//             .populate('userId', 'name email')
//             .populate('orderedItems.product', 'productName salePrice');
//         res.render('return', { returns });
//     } catch (error) {
//         console.error('Error fetching returns:', error);
//         res.redirect('/admin/pageerror');
//     }
// };

// const processReturn = async (req, res) => {
//     try {
//         const { orderId, action, adminNote, productId } = req.body;
//         console.log('Request body received:', { orderId, action, adminNote, productId });

//         const order = await Order.findById(orderId)
//             .populate('userId')
//             .populate('orderedItems.product');
//         if (!order) {
//             console.log('Order not found for ID:', orderId);
//             return res.status(404).json({ success: false, message: 'Order not found' });
//         }
//         if (order.status !== 'Return Request') {
//             console.log('Order status is not Return Request:', order.status);
//             return res.status(404).json({ success: false, message: 'Invalid return request' });
//         }
//         console.log('Order found:', order._id, 'User ID:', order.userId?._id);

//         if (action === 'approve') {
//             let refundAmount = 0;
//             if (order.orderedItems.length === 1 || !productId) {
//                 order.status = 'Returned';
//                 refundAmount = order.finalAmount;
//                 console.log('Full return, refundAmount:', refundAmount);
//                 for (const item of order.orderedItems) {
//                     await Product.findByIdAndUpdate(item.product._id, { $inc: { quantity: item.quantity } });
//                 }
//             } else {
//                 const item = order.orderedItems.find(i => i.product._id.toString() === productId);
//                 if (!item) {
//                     console.log('Item not found in order:', productId);
//                     return res.status(404).json({ success: false, message: 'Product not found in order' });
//                 }
//                 refundAmount = item.price * item.quantity;
//                 console.log('Partial return, refundAmount:', refundAmount);
//                 order.orderedItems = order.orderedItems.filter(i => i.product._id.toString() !== productId);
//                 order.totalPrice = order.orderedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
//                 order.finalAmount = order.totalPrice - (order.discount || 0);
//                 order.status = order.orderedItems.length > 0 ? 'Delivered' : 'Returned';
//                 await Product.findByIdAndUpdate(item.product._id, { $inc: { quantity: item.quantity } });
//             }

//             order.adminNote = adminNote || 'Approved via returns page';
//             await order.save();
//             console.log('Order updated:', order._id, 'Status:', order.status);

//             if (!order.userId?._id) {
//                 console.log('User ID is missing or invalid:', order.userId);
//                 return res.status(500).json({ success: false, message: 'User ID missing from order' });
//             }

//             const userBefore = await User.findById(order.userId._id);
//             console.log('User before update:', userBefore?.wallet, userBefore?.walletTransactions);

//             const userUpdate = await User.findByIdAndUpdate(
//                 order.userId._id,
//                 {
//                     $inc: { wallet: refundAmount },
//                     $push: {
//                         walletTransactions: {
//                             type: 'credit',
//                             amount: refundAmount,
//                             description: `Refund for returned order #${orderId}`,
//                             orderId: orderId,
//                             date: new Date() // Explicitly set date
//                         }
//                     }
//                 },
//                 { new: true, runValidators: true }
//             );
//             console.log('User update result:', userUpdate?.wallet, userUpdate?.walletTransactions);

//             if (!userUpdate) {
//                 console.log('User update failed, no document returned');
//                 return res.status(500).json({ success: false, message: 'Failed to update user wallet' });
//             }

//             res.json({ success: true, message: `Return approved, ₹${refundAmount} refunded to wallet` });
//         } else if (action === 'reject') {
//             order.status = 'Delivered';
//             order.adminNote = adminNote || 'Rejected via returns page';
//             await order.save();
//             console.log('Order rejected:', order._id);
//             res.json({ success: true, message: 'Return rejected' });
//         } else {
//             console.log('Invalid action:', action);
//             return res.status(400).json({ success: false, message: 'Invalid action' });
//         }
//     } catch (error) {
//         console.error('Error processing return:', error.message, error.stack);
//         res.status(500).json({ success: false, message: 'Server error' });
//     }
// };


const getReturnRequests = async (req, res) => {
    try {
        const orders = await Order.find({ 'orderedItems.status': 'Return Request' })
            .populate('userId', 'name email')
            .populate('orderedItems.product', 'productName salePrice');
        res.render('return', { returns: orders });
    } catch (error) {
        console.error('Error fetching returns:', error);
        res.redirect('/admin/pageerror');
    }
};

// Updated processReturn to handle individual items
const processReturn = async (req, res) => {
    try {
        const { orderId, productId, action, adminNote } = req.body;
        console.log('Request body received:', { orderId, productId, action, adminNote });

        const order = await Order.findById(orderId)
            .populate('userId')
            .populate('orderedItems.product');
        if (!order) {
            console.log('Order not found for ID:', orderId);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const item = order.orderedItems.find(i => i.product._id.toString() === productId);
        if (!item) {
            console.log('Item not found in order:', productId);
            return res.status(404).json({ success: false, message: 'Product not found in order' });
        }

        if (item.status !== 'Return Request') {
            console.log('Item status is not Return Request:', item.status);
            return res.status(400).json({ success: false, message: 'Invalid return request for this item' });
        }

        if (action === 'approve') {
            item.status = 'Returned';
            const refundAmount = item.price * item.quantity;
            console.log('Item return approved, refundAmount:', refundAmount);

            // Update product quantity
            await Product.findByIdAndUpdate(item.product._id, {
                $inc: { quantity: item.quantity }
            });

            // Update order totals
            const remainingItems = order.orderedItems.filter(i => i.status !== 'Returned');
            if (remainingItems.length === 0) {
                order.totalPrice = 0;
                order.finalAmount = 0;
            } else {
                order.totalPrice = remainingItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
                order.finalAmount = order.totalPrice - (order.discount || 0);
            }

            // Update order status
            const allItemsReturned = order.orderedItems.every(i => i.status === 'Returned');
            const anyItemReturnRequested = order.orderedItems.some(i => i.status === 'Return Request');
            if (allItemsReturned) {
                order.status = 'Returned';
            } else if (anyItemReturnRequested) {
                order.status = 'Return Request';
            } else {
                const activeStatuses = order.orderedItems
                    .filter(i => !['Cancelled', 'Return Request', 'Returned'].includes(i.status))
                    .map(i => i.status);
                const statusPriority = ['Pending', 'Processing', 'Shipped', 'Delivered'];
                order.status = activeStatuses.length > 0
                    ? statusPriority[Math.min(...activeStatuses.map(s => statusPriority.indexOf(s)))]
                    : 'Delivered'; // Fallback if no active items
            }

            order.adminNote = adminNote || 'Approved via returns page';
            await order.save();
            console.log('Order updated:', order._id, 'Status:', order.status);

            if (!order.userId?._id) {
                console.log('User ID is missing or invalid:', order.userId);
                return res.status(500).json({ success: false, message: 'User ID missing from order' });
            }

            const userBefore = await User.findById(order.userId._id);
            console.log('User before update:', userBefore?.wallet, userBefore?.walletTransactions);

            const userUpdate = await User.findByIdAndUpdate(
                order.userId._id,
                {
                    $inc: { wallet: refundAmount },
                    $push: {
                        walletTransactions: {
                            type: 'credit',
                            amount: refundAmount,
                            description: `Refund for returned item in order #${order.orderId}`,
                            orderId: order._id,
                            date: new Date()
                        }
                    }
                },
                { new: true, runValidators: true }
            );
            console.log('User update result:', userUpdate?.wallet, userUpdate?.walletTransactions);

            if (!userUpdate) {
                console.log('User update failed, no document returned');
                return res.status(500).json({ success: false, message: 'Failed to update user wallet' });
            }

            res.json({ success: true, message: `Return approved, ₹${refundAmount} refunded to wallet` });
        } else if (action === 'reject') {
            item.status = 'Delivered';
            order.adminNote = adminNote || 'Rejected via returns page';

            // Update order status
            const anyItemReturnRequested = order.orderedItems.some(i => i.status === 'Return Request');
            if (!anyItemReturnRequested) {
                const activeStatuses = order.orderedItems
                    .filter(i => !['Cancelled', 'Return Request', 'Returned'].includes(i.status))
                    .map(i => i.status);
                const statusPriority = ['Pending', 'Processing', 'Shipped', 'Delivered'];
                order.status = activeStatuses.length > 0
                    ? statusPriority[Math.min(...activeStatuses.map(s => statusPriority.indexOf(s)))]
                    : 'Delivered';
            }

            await order.save();
            console.log('Order rejected:', order._id);
            res.json({ success: true, message: 'Return rejected' });
        } else {
            console.log('Invalid action:', action);
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }
    } catch (error) {
        console.error('Error processing return:', error.message, error.stack);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


module.exports={
    orderList,
    orderDetails,
    updateItemStatus,
    updateOrderStatus,
    getReturnRequests,
    processReturn,
   
}