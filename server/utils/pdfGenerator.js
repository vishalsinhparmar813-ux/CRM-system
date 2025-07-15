const PDFDocument = require('pdfkit');

const formatCurrency = (amount) => `INR ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const generateInvoicePDF = async ({ order, client, product }) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40 });
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // Header
            doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
            doc.moveDown(1.5);

            // Order Info Row (fixed positions)
            doc.fontSize(12).font('Helvetica-Bold').text('Order Information', { underline: true });
            doc.moveDown(0.5);
            doc.font('Helvetica').fontSize(11);
            let y = doc.y;
            doc.text(`Order No: ${order.orderNo}`, 50, y, { width: 120 });
            doc.text(`Order Date: ${new Date(order.date).toLocaleDateString()}`, 220, y, { width: 150 });
            doc.text(`Due Date: ${new Date(order.dueDate).toLocaleDateString()}`, 400, y, { width: 120 });
            doc.moveDown(2);

            // Client Info
            doc.fontSize(12).font('Helvetica-Bold').text('Client Details', 50, doc.y, { underline: true });
            doc.moveDown(0.5);
            doc.font('Helvetica').fontSize(11);
            y = doc.y;
            doc.text(`Name: ${client.name || 'N/A'}`, 50, y, { width: 250 });
            y = doc.y;
            doc.text(`Email: ${client.email || 'N/A'}`, 50, y, { width: 350 });
            y = doc.y;
            doc.text(`Client ID: ${client._id}`, 50, y, { width: 500 });
            doc.moveDown(2);

            // Product Table Header
            doc.fontSize(12).font('Helvetica-Bold').text('Product Details', 50, doc.y, { underline: true });
            doc.moveDown(0.5);
            y = doc.y;
            // Draw table header
            doc.font('Helvetica-Bold').fontSize(11);
            doc.text('Product Name', 50, y, { width: 80 });
            doc.text('Product ID', 130, y, { width: 170 });
            doc.text('Qty', 300, y, { width: 40, align: 'right' });
            doc.text('Unit', 340, y, { width: 60 });
            doc.text('Rate', 400, y, { width: 70, align: 'right' });
            doc.text('Amount', 470, y, { width: 80, align: 'right' });
            y += 16;
            // Draw header line
            doc.moveTo(50, y).lineTo(550, y).stroke();
            y += 4;
            // Product Table Row
            doc.font('Helvetica').fontSize(11);
            doc.text(product.name, 50, y, { width: 80 });
            doc.text(product._id, 130, y, { width: 170 });
            doc.text(order.quantity.toString(), 300, y, { width: 40, align: 'right' });
            doc.text(product.unitType, 340, y, { width: 60 });
            doc.text(formatCurrency(product.ratePerUnit), 400, y, { width: 70, align: 'right' });
            doc.text(formatCurrency(order.amount), 470, y, { width: 80, align: 'right' });
            y += 18;
            // Draw bottom line
            doc.moveTo(50, y).lineTo(550, y).stroke();
            doc.moveDown(2);

            // Order Summary Section
            doc.fontSize(12).font('Helvetica-Bold').text('Order Summary', 50, doc.y, { underline: true });
            doc.moveDown(0.5);
            doc.font('Helvetica').fontSize(11);
            y = doc.y;
            doc.text('Subtotal:', 370, y, { width: 80 });
            doc.text(formatCurrency(order.amount + (order.discount || 0)), 470, y, { width: 80, align: 'right' });
            y += 16;
            doc.text('Discount:', 370, y, { width: 80 });
            doc.text(formatCurrency(order.discount || 0), 470, y, { width: 80, align: 'right' });
            y += 16;
            doc.font('Helvetica-Bold');
            doc.text('Final Total:', 370, y, { width: 80 });
            doc.text(formatCurrency(order.amount), 470, y, { width: 80, align: 'right' });
            doc.font('Helvetica');

            doc.moveDown(3);
            doc.fontSize(10).fillColor('gray').text('Thank you for your business!', { align: 'center' });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

const generateTransactionReceiptPDF = async ({ transaction, order, client, products }) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40 });
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // Header
            doc.fontSize(22).font('Helvetica-Bold').text('PAYMENT RECEIPT', { align: 'center' });
            doc.moveDown(1.5);

            // Transaction Info
            doc.fontSize(12).font('Helvetica-Bold').text('Transaction Details', { underline: true });
            doc.moveDown(0.5);
            doc.font('Helvetica').fontSize(11);
            let y = doc.y;
            doc.text(`Receipt No: ${transaction._id}`, 50, y, { width: 250 });
            doc.text(`Date: ${new Date(transaction.date).toLocaleDateString()}`, 320, y, { width: 200 });
            doc.moveDown(1.5);

            // Client Info
            doc.fontSize(12).font('Helvetica-Bold').text('Client Details', 50, doc.y, { underline: true });
            doc.moveDown(0.5);
            doc.font('Helvetica').fontSize(11);
            y = doc.y;
            doc.text(`Name: ${client.name || 'N/A'}`, 50, y, { width: 250 });
            y = doc.y;
            doc.text(`Email: ${client.email || 'N/A'}`, 50, y, { width: 350 });
            y = doc.y;
            doc.text(`Client ID: ${client._id}`, 50, y, { width: 500 });
            doc.moveDown(2);

            // Order Info
            doc.fontSize(12).font('Helvetica-Bold').text('Order Details', 50, doc.y, { underline: true });
            doc.moveDown(0.5);
            doc.font('Helvetica').fontSize(11);
            y = doc.y;
            doc.text(`Order No: ${order.orderNo}`, 50, y, { width: 120 });
            doc.text(`Order Date: ${new Date(order.date).toLocaleDateString()}`, 220, y, { width: 150 });
            doc.text(`Due Date: ${order.dueDate ? new Date(order.dueDate).toLocaleDateString() : '-'}`, 400, y, { width: 120 });
            doc.moveDown(2);

            // Products Table (summary)
            doc.fontSize(12).font('Helvetica-Bold').text('Products', 50, doc.y, { underline: true });
            doc.moveDown(0.5);
            y = doc.y;
            doc.font('Helvetica-Bold').fontSize(11);
            doc.text('Product Name', 50, y, { width: 120 });
            doc.text('Qty', 170, y, { width: 40, align: 'right' });
            doc.text('Unit', 210, y, { width: 60 });
            doc.text('Amount', 270, y, { width: 80, align: 'right' });
            y += 16;
            doc.moveTo(50, y).lineTo(350, y).stroke();
            y += 4;
            doc.font('Helvetica').fontSize(11);
            for (const p of products) {
                doc.text(p.name, 50, y, { width: 120 });
                doc.text(p.quantity ? p.quantity.toString() : '-', 170, y, { width: 40, align: 'right' });
                doc.text(p.unitType || '-', 210, y, { width: 60 });
                doc.text(formatCurrency(p.amount || 0), 270, y, { width: 80, align: 'right' });
                y += 16;
            }
            doc.moveDown(2);

            // Payment Info
            doc.fontSize(12).font('Helvetica-Bold').text('Payment Info', 50, doc.y, { underline: true });
            doc.moveDown(0.5);
            doc.font('Helvetica').fontSize(11);
            y = doc.y;
            doc.text('Paid Amount:', 50, y, { width: 120 });
            doc.text(formatCurrency(transaction.amount), 170, y, { width: 120 });
            y += 16;
            // Optionally, add remaining, status, etc.

            doc.moveDown(3);
            doc.fontSize(10).fillColor('gray').text('Thank you for your payment!', { align: 'center' });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

module.exports = generateInvoicePDF;
module.exports.generateTransactionReceiptPDF = generateTransactionReceiptPDF;
