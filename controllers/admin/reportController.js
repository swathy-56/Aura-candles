const Order = require('../../models/orderSchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const getSalesReportPage = async (req, res) => {
    try {
        const report = req.session.salesReport || {
            orders: await Order.find({}).sort({ createdOn: -1 })
                .populate('orderedItems.product'),
            totalSales: 0,
            totalDiscount: 0,
            totalFinalAmount: 0,
            totalOrders: 0
        };

        console.log('Raw orders from DB:', report.orders);

        report.orders = report.orders.map(order => {
            order.createdOn = new Date(order.createdOn);
            return order;
        });

        report.totalSales = report.orders.reduce((sum, order) => sum + order.totalPrice, 0);
        report.totalDiscount = report.orders.reduce((sum, order) => sum + order.discount, 0);
        report.totalFinalAmount = report.orders.reduce((sum, order) => sum + order.finalAmount, 0);
        report.totalOrders = report.orders.length;

        console.log('Processed report:', {
            ordersCount: report.orders.length,
            totalSales: report.totalSales,
            totalDiscount: report.totalDiscount,
            totalFinalAmount: report.totalFinalAmount
        });

        res.render('sales-report', {
            orders: report.orders,
            totalSales: report.totalSales,
            totalDiscount: report.totalDiscount,
            totalFinalAmount: report.totalFinalAmount,
            totalOrders: report.totalOrders
        });
    } catch (error) {
        console.error('Error in getSalesReportPage:', error);
        res.status(500).send('Server Error: Unable to load sales report');
    }
};

const generateSalesReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.body;
        let dateFilter = {};

        const now = new Date();
        switch (reportType) {
            case 'daily':
                dateFilter = {
                    createdOn: {
                        $gte: new Date(now.setHours(0, 0, 0, 0)),
                        $lte: new Date(now.setHours(23, 59, 59, 999))
                    }
                };
                break;
            case 'weekly':
                dateFilter = {
                    createdOn: {
                        $gte: new Date(now.setDate(now.getDate() - 7)),
                        $lte: new Date()
                    }
                };
                break;
            case 'monthly':
                dateFilter = {
                    createdOn: {
                        $gte: new Date(now.setMonth(now.getMonth() - 1)),
                        $lte: new Date()
                    }
                };
                break;
            case 'custom':
                if (!startDate || !endDate) {
                    return res.json({ success: false, message: 'Start and end dates are required for custom range' });
                }
                dateFilter = {
                    createdOn: {
                        $gte: new Date(startDate).setHours(0,0,0),
                        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
                    }
                };
                break;
            default:
                return res.json({ success: false, message: 'Invalid report type' });
        }

        const orders = await Order.find({
            ...dateFilter,
        }).sort({createdOn:-1}).populate('orderedItems.product');

        console.log('Fetched orders for report:', orders);

        const formattedOrders = orders.map(order => {
            order.createdOn = new Date(order.createdOn);
            return order;
        });

        const totalSales = formattedOrders.reduce((sum, order) => sum + order.totalPrice, 0);
        const totalDiscount = formattedOrders.reduce((sum, order) => sum + order.discount, 0);
        const totalFinalAmount = formattedOrders.reduce((sum, order) => sum + order.finalAmount, 0);
        const totalOrders = formattedOrders.length;

        req.session.salesReport = {
            orders: formattedOrders,
            totalSales,
            totalDiscount,
            totalFinalAmount,
            totalOrders
        };

        res.json({ success: true });
    } catch (error) {
        console.error('Error in generateSalesReport:', error);
        res.json({ success: false, message: 'Error generating report' });
    }
};

const downloadSalesReport = async (req, res) => {
    try {
        const { format } = req.body;
        const report = req.session.salesReport;

        if (!report || !report.orders) {
            return res.status(400).json({ success: false, message: 'No sales report data available. Generate a report first.' });
        }

        console.log('Session report before download:', JSON.stringify(report.orders, null, 2));

        report.orders = report.orders.map(order => {
            const createdOn = new Date(order.createdOn);
            if (isNaN(createdOn.getTime())) {
                console.error(`Invalid date for order ${order.orderId}: ${order.createdOn}`);
                order.createdOn = new Date();
            } else {
                order.createdOn = createdOn;
            }
            return order;
        });

        if (format === 'pdf') {
            const doc = new PDFDocument({ margin: 30, size: 'A4' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="sales-report.pdf"');
            doc.pipe(res);

            // Header Section
            doc.fontSize(22).font('Helvetica-Bold').fillColor('#2E2E2E').text('Sales Report', { align: 'center' });
            doc.fontSize(12).font('Helvetica').fillColor('#555555')
                .text(`Aura Candles | Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
            doc.moveDown(1.5);
            doc.moveTo(30, doc.y).lineTo(565, doc.y).stroke('#E0E0E0'); // Subtle divider line
            doc.moveDown(1);

            // Table Setup
            const tableTop = doc.y;
            const colWidths = [110, 100, 90, 80, 80, 95]; // Adjusted for better spacing
            const headers = ['Order ID', 'Date', 'Total Amount', 'Discount', 'Coupon', 'Final Amount'];

            // Table Header Background
            doc.rect(30, tableTop - 5, 535, 25).fill('#F5F5F5').stroke('#D3D3D3');
            doc.fillColor('#333333');

            // Draw Headers
            let xPos = 10;
            headers.forEach((header, i) => {
                doc.fontSize(11).font('Helvetica-Bold')
                    .text(header, xPos + 5, tableTop + 5, { width: colWidths[i] - 10, align: 'center' });
                xPos += colWidths[i];
            });

            // Table Rows
            let yPos = tableTop + 30;
            doc.font('Helvetica').fontSize(10).fillColor('#000000');
            report.orders.forEach((order, index) => {
                xPos = 10;
                const row = [
                    order.orderId || 'N/A',
                    order.createdOn.toLocaleDateString(),
                    `₹${order.totalPrice.toFixed(2)}`,
                    `₹${order.discount.toFixed(2)}`,
                    order.coupon?.code || 'None',
                    `₹${order.finalAmount.toFixed(2)}`
                ];

                // Alternate row shading
                if (index % 2 === 0) {
                    doc.rect(30, yPos - 5, 535, 20).fill('#FAFAFA');
                }
                doc.fillColor('#000000');

                row.forEach((cell, i) => {
                    const align = (i === 2 || i === 3 || i === 5) ? 'center' : 'center';
                    doc.text(cell, xPos + 5, yPos, { width: colWidths[i] - 10, align });
                    xPos += colWidths[i];
                });

                yPos += 20;

                // Page overflow handling
                if (yPos > doc.page.height - 80) {
                    doc.addPage();
                    yPos = 50;
                    // Redraw table headers on new page
                    xPos = 30;
                    doc.rect(30, yPos - 5, 535, 25).fill('#F5F5F5').stroke('#D3D3D3');
                    doc.fillColor('#333333');
                    headers.forEach((header, i) => {
                        doc.fontSize(11).font('Helvetica-Bold')
                            .text(header, xPos + 5, yPos + 5, { width: colWidths[i] - 10, align: 'center' });
                        xPos += colWidths[i];
                    });
                    yPos += 30;
                    doc.font('Helvetica').fontSize(10).fillColor('#000000');
                }
            });

            // Totals Section
            doc.moveDown(1);
            doc.moveTo(30, yPos).lineTo(565, yPos).stroke('#E0E0E0');
            yPos += 10;
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#333333').text('Summary', 30, yPos);
            doc.font('Helvetica').fontSize(11);
            const totals = [
                `Total Orders: ${report.totalOrders}`,
                `Total Sales: ₹${report.totalSales.toFixed(2)}`,
                `Total Discount: ₹${report.totalDiscount.toFixed(2)}`,
                `Final Amount: ₹${report.totalFinalAmount.toFixed(2)}`
            ];
            totals.forEach((text, i) => {
                doc.text(text, 350 - (i % 2) * 150, yPos + (Math.floor(i / 2) * 20), { align: 'right', width: 200 });
            });

            // Footer
            const footerY = doc.page.height - 40;
            doc.moveTo(30, footerY - 10).lineTo(565, footerY - 10).stroke('#E0E0E0');
            doc.fontSize(9).font('Helvetica-Oblique').fillColor('#666666')
                .text('Aura Candles - Sales Report', 30, footerY, { align: 'center' });

            doc.end();
        } else if (format === 'excel') {
            
        } else {
            res.status(400).json({ success: false, message: 'Invalid format' });
        }
    } catch (error) {
        console.error('Error in downloadSalesReport:', error);
        res.status(500).json({ success: false, message: 'Error downloading report: ' + error.message });
    }
};

module.exports = {
    getSalesReportPage,
    generateSalesReport,
    downloadSalesReport
};