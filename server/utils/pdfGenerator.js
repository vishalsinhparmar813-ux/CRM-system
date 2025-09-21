const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// =========================
// ===== COMMON HELPERS ====
// =========================

function formatCurrency(amount) {
  return `Rs.${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

// Server-side unit labels to keep consistent with client `unitUtils.js`
const UnitTypeLabels = {
  'Sq. Ft.': 'Sq. Ft.',
  'Sq. M.': 'Sq. M.',
  'NOS': 'NOS',
  'SET': 'SET',
  // Backward compatibility for old enum values
  SQUARE_FEET: 'Sq. Ft.',
  SQUARE_METER: 'Sq. M.',
  NOS: 'NOS',
  SET: 'SET',
};

function getUnitLabel(unitType) {
  return UnitTypeLabels[unitType] || (unitType || '-');
}

// Consistent date formatting function for all PDFs
function formatDateConsistent(dateInput) {
  console.log('formatDateConsistent input:', dateInput, typeof dateInput);
  
  if (!dateInput) {
    console.log('No date input, using current date');
    return new Date().toLocaleDateString('en-GB');
  }
  
  let date;
  // If it's a string in YYYY-MM-DD format, convert to Date
  if (typeof dateInput === 'string') {
    // Handle YYYY-MM-DD format properly
    if (dateInput.includes('-')) {
      const [year, month, day] = dateInput.split('-');
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      date = new Date(dateInput);
    }
  } else {
    date = new Date(dateInput);
  }
  
  console.log('Parsed date:', date);
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    console.log('Invalid date, using current date');
    return new Date().toLocaleDateString('en-GB');
  }
  
  const formattedDate = date.toLocaleDateString('en-GB');
  console.log('Formatted date:', formattedDate);
  return formattedDate;
}

function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  if (num === 0) return 'Zero';
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' and ' + numberToWords(num % 100) : '');
  if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
  if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
  return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '');
}

// =============================
// ===== TABLE DRAWING HELPER ===
// =============================
function drawBorderedTable(doc, headers, rows, colWidths, startX, startY, options = {}) {
  const { padding = 4, align = [], headerFont = 'Helvetica-Bold', rowFont = 'Helvetica', fontSize = 7, headerFontSize = 8 } = options;
  let y = startY;

  // Draw header row if headers exist
  if (headers && headers.length > 0 && headers.some(h => h)) {
    let x = startX;
    doc.font(headerFont).fontSize(headerFontSize).fillColor('#000');
    
    // Calculate header height based on content
    let headerHeight = 20;
    headers.forEach((header, i) => {
      if (header && header.includes('\n')) {
        headerHeight = Math.max(headerHeight, 24);
      }
    });
    
    headers.forEach((header, i) => {
      doc.rect(x, y, colWidths[i], headerHeight).stroke();
      
      // Calculate vertical centering for header text
      const textHeight = doc.heightOfString(header || '', { width: colWidths[i] - padding * 2 });
      const verticalOffset = (headerHeight - textHeight) / 2;
      
      doc.text(header || '', x + padding, y + verticalOffset, { 
        width: colWidths[i] - padding * 2, 
        align: align[i] || 'left',
        lineGap: 0
      });
      x += colWidths[i];
    });
    y += headerHeight;
  }

  // Draw data rows with proper padding
  doc.font(rowFont).fontSize(fontSize).fillColor('#000');
  rows.forEach((row, rowIndex) => {
    let rowHeight = 14;
    row.forEach((cell, i) => {
      const cellHeight = doc.heightOfString(String(cell || ''), { width: colWidths[i] - padding * 2, fontSize });
      rowHeight = Math.max(rowHeight, Math.min(cellHeight + padding * 2, 20));
    });

    let xPos = startX;
    row.forEach((cell, i) => {
      doc.rect(xPos, y, colWidths[i], rowHeight).stroke();
      
      // Check if this is an important field and make it bold
      const cellText = String(cell || '');
      const isImportantField = cellText.includes('GSTIN') || cellText.includes('State Name') || 
                               cellText.includes('RAVI PRECAST') || cellText.includes('Total') ||
                               cellText.includes('Declaration') || cellText.includes("Company's Bank Details") ||
                               cellText.includes('Limbadiya gam') || cellText.includes('By Road');
      
      if (isImportantField) {
        doc.font('Helvetica-Bold').fontSize(fontSize + 1);
      } else {
        doc.font(rowFont).fontSize(fontSize);
      }
      
      doc.text(cellText, xPos + padding, y + padding, { 
        width: colWidths[i] - padding * 2, 
        align: align[i] || 'left',
        lineGap: -1
      });
      xPos += colWidths[i];
    });

    y += rowHeight;
  });

  return y;
}

// Generate Client Ledger PDF
function generateClientLedgerPDF(clientData, orders) {
  return new Promise((resolve, reject) => {
    try {
      // Validate input data
      if (!clientData || !clientData.name) {
        return reject(new Error('Invalid client data provided'));
      }
      
      if (!orders || !Array.isArray(orders) || orders.length === 0) {
        return reject(new Error('No orders provided for PDF generation'));
      }

      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      
      let buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => {
        try {
          const pdfData = Buffer.concat(buffers);
          if (pdfData.length === 0) {
            return reject(new Error('Generated PDF buffer is empty'));
          }
          resolve(pdfData);
        } catch (err) {
          reject(new Error(`Error concatenating PDF buffer: ${err.message}`));
        }
      });
      
      doc.on('error', (err) => {
        reject(new Error(`PDF generation error: ${err.message}`));
      });

      // Header
      doc.fontSize(20).font('Helvetica-Bold');
      doc.text('RAVI PAVER BLOCK', 50, 50, { align: 'center' });
      doc.fontSize(12).font('Helvetica');
      doc.text('Client Ledger Report', 50, 80, { align: 'center' });
      
      // Client Information
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text(`Client: ${clientData.name || 'N/A'}`, 50, 120);
      doc.fontSize(10).font('Helvetica');
      if (clientData.mobile) doc.text(`Mobile: ${clientData.mobile}`, 50, 140);
      if (clientData.email) doc.text(`Email: ${clientData.email}`, 50, 155);
      
      // Date
      doc.text(`Generated on: ${formatDateConsistent(new Date())}`, 400, 120);
      
      // Calculate totals - keep advanced payments separate
      let grossBillTotal = 0;
      let totalOrderPaidAmount = 0;
      let totalRemainingAmount = 0;
      let totalAdvancedAmount = Number(clientData.totalAdvancedAmount || 0);
      
      orders.forEach(order => {
        grossBillTotal += Number(order.totalAmount || 0);
        totalOrderPaidAmount += Number(order.totalPaid || 0);
        totalRemainingAmount += Number(order.remainingAmount || 0);
      });
      
      // Total received includes both order payments and advanced payments
      const totalReceivedAmount = totalOrderPaidAmount + totalAdvancedAmount;
      
      // Outstanding amount is bill total minus total received
      const outstandingAmount = grossBillTotal - totalReceivedAmount;  
      
      // Calculate cash total from products
      let grossCashTotal = 0;
      orders.forEach(order => {
        if (order.products && Array.isArray(order.products)) {
          order.products.forEach(product => {
            if (product.cashRate != null && product.quantity != null) {
              grossCashTotal += Number(product.cashRate) * Number(product.quantity);
            }
          });
        }
      });
      
      // Summary boxes (keeping original format)
      doc.fontSize(12).font('Helvetica-Bold');
      doc.rect(50, 180, 200, 40).stroke();
      doc.text('Gross Bill Total', 60, 190);
      doc.text(`Rs.${grossBillTotal.toLocaleString('en-IN')}`, 60, 205);

      doc.rect(300, 180, 200, 40).stroke();
      doc.text('Gross Cash Total', 310, 190);
      doc.text(`Rs.${grossCashTotal.toLocaleString('en-IN')}`, 310, 205);

      // Orders Table (Original Format)
      let y = 250;
      const tableHeaders = [
        { text: 'Order No', x: 50, width: 60 },
        { text: 'Date', x: 110, width: 70 },
        { text: 'Products', x: 180, width: 80 },
        { text: 'Quantity', x: 260, width: 60 },
        { text: 'Rate', x: 320, width: 60 },
        { text: 'Cash Rate', x: 380, width: 60 },
        { text: 'Cash Total', x: 440, width: 60 },
        { text: 'Bill Amount', x: 500, width: 65 }
      ];

      // Draw header
      doc.fontSize(9).font('Helvetica-Bold');
      tableHeaders.forEach(header => {
        doc.text(header.text, header.x, y, { width: header.width, align: 'center' });
      });

      // Header line
      doc.moveTo(50, y + 15).lineTo(565, y + 15).stroke();
      y += 25;

      // Table rows (Original Format)
      doc.fontSize(8).font('Helvetica');

      orders.forEach(order => {
        let maxProductLines = 1;

        // Calculate max lines needed for products
        if (order.products && Array.isArray(order.products) && order.products.length > 0) {
          maxProductLines = Math.max(order.products.length, 1);
        }

        // Check if we need a new page
        if (y + (maxProductLines * 12) > 750) {
          doc.addPage();
          y = 50;

          // Redraw header on new page
          doc.fontSize(9).font('Helvetica-Bold');
          tableHeaders.forEach(header => {
            doc.text(header.text, header.x, y, { width: header.width, align: 'center' });
          });
          doc.moveTo(50, y + 15).lineTo(565, y + 15).stroke();
          y += 25;
          doc.fontSize(8).font('Helvetica');
        }

        // Order No
        doc.text(`#${order.orderNo || 'N/A'}`, 50, y);
        // Date
        let orderDate = 'N/A';
        const dateToUse = order.orderDate || order.date;
        if (dateToUse) {
          try {
            orderDate = formatDateConsistent(dateToUse);
          } catch (e) {
            orderDate = 'Invalid Date';
          }
        }
        doc.text(orderDate, 110, y);
        // Products, Quantity, Rate, Cash Rate, Cash Total (multiple lines)
        if (order.products && order.products.length > 0) {
          order.products.forEach((product, index) => {
            const productY = y + (index * 12);

            // Product name
            doc.text(product.productName || 'Unknown Product', 180, productY);
            // Quantity
            const quantity = `${product.quantity || 0} ${getUnitLabel(product.unitType)}`;
            doc.text(quantity, 260, productY);
            // Rate
            const rate = product.ratePrice ? `Rs.${Number(product.ratePrice).toFixed(2)}` : '-';
            doc.text(rate, 320, productY);
            // Cash Rate
            const cashRate = product.cashRate ? `Rs.${Number(product.cashRate).toFixed(2)}` : '-';
            doc.text(cashRate, 380, productY);
            // Cash Total
            const cashTotal = product.cashRate && product.quantity ? 
              Number(product.cashRate) * Number(product.quantity) : 0;
            doc.text(cashTotal > 0 ? `Rs.${cashTotal.toFixed(2)}` : '-', 440, productY);
          });
        } else {
          // No products case
          doc.text('No Products', 180, y);
          doc.text('-', 260, y);
          doc.text('-', 320, y);
          doc.text('-', 380, y);
          doc.text('-', 440, y);
        }

        // Bill Amount (single value for entire order)
        const billAmount = `Rs.${Number(order.totalAmount || 0).toLocaleString('en-IN')}`;
        doc.text(billAmount, 500, y);
        y += maxProductLines * 12 + 5;

        // Row separator line
        doc.moveTo(50, y).lineTo(565, y).stroke();
        y += 5;
      });

      // Orders Summary
      y += 20;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`Total Orders: ${orders.length}`, 50, y);
      doc.text(`Total Bill Amount: Rs.${grossBillTotal.toLocaleString('en-IN')}`, 300, y);

      // Dispatch Details Section (New Section)
      y += 40;
      
      // Check if we need a new page for dispatch data
      if (y > 600) {
        doc.addPage();
        y = 50;
      }

      doc.fontSize(16).font('Helvetica-Bold');
      doc.text('DISPATCH DETAILS', 50, y, { align: 'center', width: 500 });
      y += 30;

      // Calculate dispatch totals
      let totalDispatches = 0;
      let totalDispatchedAmount = 0;
      
      orders.forEach(order => {
        if (order.dispatches && order.dispatches.length > 0) {
          totalDispatches += order.dispatches.length;
          order.dispatches.forEach(dispatch => {
            totalDispatchedAmount += Number(dispatch.totalAmount || 0);
          });
        }
      });

      // Dispatch Summary Boxes
      doc.fontSize(11).font('Helvetica-Bold');
      
      doc.rect(50, y, 150, 35).stroke();
      doc.text('Total Dispatches', 55, y + 8);
      doc.text(`${totalDispatches}`, 55, y + 22);

      doc.rect(220, y, 150, 35).stroke();
      doc.text('Total Dispatched Amount', 225, y + 8);
      doc.text(`Rs.${totalDispatchedAmount.toLocaleString('en-IN')}`, 225, y + 22);

      doc.rect(390, y, 150, 35).stroke();
      doc.text('Remaining Dispatch Qty', 395, y + 8);
      
      // Calculate remaining dispatch quantity
      let totalOrderedQty = 0;
      let totalDispatchedQty = 0;
      
      orders.forEach(order => {
        if (order.products && order.products.length > 0) {
          order.products.forEach(product => {
            totalOrderedQty += Number(product.quantity || 0);
          });
        }
        if (order.dispatches && order.dispatches.length > 0) {
          order.dispatches.forEach(dispatch => {
            if (dispatch.dispatchedProducts && dispatch.dispatchedProducts.length > 0) {
              dispatch.dispatchedProducts.forEach(product => {
                totalDispatchedQty += Number(product.quantity || 0);
              });
            }
          });
        }
      });
      
      const remainingQty = totalOrderedQty - totalDispatchedQty;
      doc.text(`${remainingQty} Sq. Ft.`, 395, y + 22);

      y += 50;

      // Dispatch Table - Format similar to orders table
      if (orders.some(order => order.dispatches && order.dispatches.length > 0)) {
        // Check if we need a new page
        if (y + 200 > 700) {
          doc.addPage();
          y = 50;
        }

        // Dispatch table header with improved column alignment
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Order No', 50, y);
        doc.text('Date', 110, y);
        doc.text('Products', 170, y);
        doc.text('Quantity', 300, y);
        doc.text('Rate', 380, y);
        doc.text('Amount', 450, y);
        
        // Header line
        doc.moveTo(50, y + 15).lineTo(520, y + 15).stroke();
        y += 25;

        // Dispatch rows - format like orders table
        doc.fontSize(9).font('Helvetica');
        
        // Debug: Log dispatch data
        console.log('Orders with dispatches:', orders.map(o => ({
          orderNo: o.orderNo,
          dispatchCount: o.dispatches ? o.dispatches.length : 0,
          dispatches: o.dispatches ? o.dispatches.map(d => ({
            invoiceNo: d.invoiceNo,
            dispatchDate: d.dispatchDate,
            totalAmount: d.totalAmount,
            productCount: d.dispatchedProducts ? d.dispatchedProducts.length : 0,
            products: d.dispatchedProducts
          })) : []
        })));
        
        // Collect all dispatches from all orders
        const allDispatches = [];
        orders.forEach(order => {
          if (order.dispatches && order.dispatches.length > 0) {
            order.dispatches.forEach(dispatch => {
              // Enhanced dispatch object with better data mapping
              allDispatches.push({
                ...dispatch,
                orderNo: order.orderNo,
                orderProducts: order.products,
                // Ensure we have the dispatch data
                invoiceNo: dispatch.invoiceNo || `DISP-${order.orderNo}`,
                dispatchDate: dispatch.dispatchDate,
                totalAmount: dispatch.totalAmount || 0,
                dispatchedProducts: dispatch.dispatchedProducts || []
              });
            });
          }
        });

        console.log('Total dispatches found:', allDispatches.length);
        console.log('Sample dispatch data:', allDispatches.length > 0 ? allDispatches[0] : 'No dispatches');

        // If no dispatches found, show a message
        if (allDispatches.length === 0) {
          doc.fontSize(9).font('Helvetica');
          doc.text('No dispatch records found for this client.', 50, y);
          y += 20;
        } else {
          // Sort dispatches by date
          allDispatches.sort((a, b) => new Date(a.dispatchDate) - new Date(b.dispatchDate));

          // Display each dispatch
          allDispatches.forEach(dispatch => {
            let dispatchDate = 'N/A';
            if (dispatch.dispatchDate) {
              try {
                dispatchDate = formatDateConsistent(dispatch.dispatchDate);
              } catch (e) {
                dispatchDate = 'Invalid';
              }
            }
            
            console.log('Processing dispatch:', {
              orderNo: dispatch.orderNo,
              invoiceNo: dispatch.invoiceNo,
              date: dispatchDate,
              productCount: dispatch.dispatchedProducts ? dispatch.dispatchedProducts.length : 0,
              totalAmount: dispatch.totalAmount
            });
            
            if (dispatch.dispatchedProducts && dispatch.dispatchedProducts.length > 0) {
              // Show each product in separate rows
              dispatch.dispatchedProducts.forEach((product, productIndex) => {
                console.log('Processing product:', {
                  index: productIndex,
                  productName: product.productName,
                  quantity: product.quantity,
                  rate: product.rate,
                  ratePrice: product.ratePrice,
                  unitType: product.unitType,
                  productId: product.productId
                });
                
                // Find the actual product name from order products using productId
                let actualProductName = 'Unknown Product';
                
                if (dispatch.orderProducts && dispatch.orderProducts.length > 0) {
                  const orderProduct = dispatch.orderProducts.find(p => 
                    String(p.productId) === String(product.productId)
                  );
                  
                  if (orderProduct && orderProduct.productName) {
                    actualProductName = orderProduct.productName;
                  }
                }
                
                // Fallback: create a generic name if still unknown
                if (actualProductName === 'Unknown Product') {
                  actualProductName = `Product ${productIndex + 1}`;
                }
                
                const quantity = Number(product.quantity || 0);
                const rate = Number(product.ratePrice || product.rate || 0);
                const amount = quantity * rate;
                
                console.log('Rendering product row:', {
                  name: actualProductName,
                  quantity: quantity,
                  rate: rate,
                  amount: amount
                });
                
                // Only show order number and date for first product of each dispatch
                if (productIndex === 0) {
                  doc.text(`#${dispatch.orderNo || 'N/A'}`, 50, y);
                  doc.text(dispatchDate, 110, y);
                } else {
                  doc.text('', 50, y);
                  doc.text('', 110, y);
                }
                
                doc.text(actualProductName, 170, y);
                doc.text(`${quantity} ${getUnitLabel(product.unitType || 'SQUARE_FEET')}`, 300, y);
                doc.text(`Rs.${rate.toFixed(2)}`, 380, y);
                doc.text(`Rs.${amount.toLocaleString('en-IN')}`, 450, y);
                
                y += 15;
              });
              
              // Add separator line after each dispatch
              doc.moveTo(50, y).lineTo(530, y).stroke();
              y += 5;
            } else {
              // No products case - show dispatch with no products
              doc.text(`#${dispatch.orderNo || 'N/A'}`, 50, y);
              doc.text(dispatchDate, 120, y);
              doc.text('No products dispatched', 180, y);
              doc.text('0', 320, y);
              doc.text('Rs.0.00', 420, y);
              doc.text(`Rs.${Number(dispatch.totalAmount || 0).toLocaleString('en-IN')}`, 480, y);
              y += 15;
              
              // Add separator line
              doc.moveTo(50, y).lineTo(530, y).stroke();
              y += 5;
            }
          });
        }
      }

      // Transactions Section - Combine all transactions
      y += 40;
      
      // Check if we need a new page for transactions
      if (y > 650) {
        doc.addPage();
        y = 50;
      }

      doc.fontSize(16).font('Helvetica-Bold');
      doc.text('TRANSACTIONS', 50, y, { align: 'center', width: 500 });
      y += 40;

      // Payment Summary Boxes immediately after TRANSACTIONS title
      // Check if we need a new page
      if (y + 60 > 750) {
        doc.addPage();
        y = 50;
      }

      // Payment Summary Boxes with better spacing and alignment
      doc.fontSize(12).font('Helvetica-Bold');
      
      doc.rect(50, y, 130, 40).stroke();
      doc.text('Total Bill Amount', 55, y + 10);
      doc.fontSize(11).text(`Rs.${grossBillTotal.toLocaleString('en-IN')}`, 55, y + 25);

      doc.fontSize(12).rect(190, y, 130, 40).stroke();
      doc.text('Total Received', 195, y + 10);
      doc.fontSize(11).text(`Rs.${totalReceivedAmount.toLocaleString('en-IN')}`, 195, y + 25);

      doc.fontSize(12).rect(330, y, 130, 40).stroke();
      doc.text('Outstanding', 335, y + 10);
      doc.fontSize(11).text(`Rs.${outstandingAmount.toLocaleString('en-IN')}`, 335, y + 25);

      doc.fontSize(12).rect(470, y, 100, 40).stroke();
      doc.text('Payment Status', 475, y + 10);
      const overallStatus = outstandingAmount <= 0 ? 'Fully Paid' : totalReceivedAmount > 0 ? 'Partial' : 'Unpaid';
      doc.fontSize(11).text(overallStatus, 475, y + 25);

      y += 70;

      // Combine all transactions (advanced payments + order transactions) and sort by date
      const allTransactions = [];
      
      // Add advanced payments as transactions
      if (clientData.advancedPayments && clientData.advancedPayments.length > 0) {
        clientData.advancedPayments.forEach(ap => {
          // Generate transaction number if missing
          let txnNumber = ap.txnNumber || '';
          if (!txnNumber) {
            const randomNum = Math.floor(Math.random() * 900000) + 100000;
            const dateStr = ap.date ? new Date(ap.date).toISOString().slice(2, 10).replace(/-/g, '') : new Date().toISOString().slice(2, 10).replace(/-/g, '');
            txnNumber = `ADV${dateStr}${randomNum}`;
          }
          
          allTransactions.push({
            date: ap.date,
            amount: ap.amount,
            type: ap.transactionType || 'cash',
            method: ap.paymentMethod || 'Cash',
            txnNumber: txnNumber,
            orderNo: 'Advance',
            remarks: ap.remarks || 'Advanced payment',
            isAdvanced: true
          });
        });
      }
      
      // Add order transactions
      orders.forEach(order => {
        if (order.transactions && order.transactions.length > 0) {
          order.transactions.forEach(txn => {
            // Generate transaction number if missing
            let txnNumber = txn.txnNumber || '';
            if (!txnNumber) {
              const randomNum = Math.floor(Math.random() * 900000) + 100000;
              const dateStr = txn.date ? new Date(txn.date).toISOString().slice(2, 10).replace(/-/g, '') : new Date().toISOString().slice(2, 10).replace(/-/g, '');
              
              if (txn.paymentMethod === 'cash' || txn.paymentMethod === 'Cash') {
                txnNumber = `CSH${dateStr}${randomNum}`;
              } else if (txn.paymentMethod === 'online' || txn.paymentMethod === 'Online') {
                txnNumber = `ONL${dateStr}${randomNum}`;
              } else if (txn.paymentMethod === 'cheque' || txn.paymentMethod === 'Cheque') {
                txnNumber = `CHQ${dateStr}${randomNum}`;
              } else {
                txnNumber = `TXN${dateStr}${randomNum}`;
              }
            }
            
            allTransactions.push({
              date: txn.date,
              amount: txn.amount,
              type: txn.transactionType || 'cash',
              method: txn.paymentMethod || 'Cash',
              txnNumber: txnNumber,
              orderNo: `#${order.orderNo}`,
              remarks: txn.remarks || 'Payment received',
              isAdvanced: false
            });
          });
        }
      });
      
      // Sort all transactions by date (newest first) - purely chronological
      allTransactions.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        
        // If dates are the same, sort by transaction type (advanced payments first for same date)
        if (dateA.getTime() === dateB.getTime()) {
          return b.isAdvanced ? 1 : -1;
        }
        
        return dateB - dateA;
      });
      
      // Create unified transactions table
      if (allTransactions.length > 0) {
        // Table header with proper column widths
        doc.fontSize(9).font('Helvetica-Bold');
        
        const tableX = 50;
        const colWidths = [65, 75, 45, 65, 85, 75, 80]; // Date, Amount, Type, Method, TxnNumber, OrderNo, Remarks
        let currentX = tableX;
        
        // Headers
        doc.text('Date', currentX, y);
        currentX += colWidths[0];
        doc.text('Amount', currentX, y);
        currentX += colWidths[1];
        doc.text('Type', currentX, y);
        currentX += colWidths[2];
        doc.text('Method', currentX, y);
        currentX += colWidths[3];
        doc.text('Txn Number', currentX, y);
        currentX += colWidths[4];
        doc.text('Order No', currentX, y);
        currentX += colWidths[5];
        doc.text('Remarks', currentX, y);
        
        // Header line
        doc.moveTo(tableX, y + 15).lineTo(tableX + colWidths.reduce((a, b) => a + b, 0), y + 15).stroke();
        y += 25;

        // Transaction rows
        doc.fontSize(8).font('Helvetica');
        allTransactions.forEach(txn => {
          // Check if we need a new page
          if (y > 720) {
            doc.addPage();
            y = 50;
            
            // Repeat header on new page
            doc.fontSize(9).font('Helvetica-Bold');
            currentX = tableX;
            doc.text('Date', currentX, y);
            currentX += colWidths[0];
            doc.text('Amount', currentX, y);
            currentX += colWidths[1];
            doc.text('Type', currentX, y);
            currentX += colWidths[2];
            doc.text('Method', currentX, y);
            currentX += colWidths[3];
            doc.text('Txn Number', currentX, y);
            currentX += colWidths[4];
            doc.text('Order No', currentX, y);
            currentX += colWidths[5];
            doc.text('Remarks', currentX, y);
            
            doc.moveTo(tableX, y + 15).lineTo(tableX + colWidths.reduce((a, b) => a + b, 0), y + 15).stroke();
            y += 25;
            doc.fontSize(8).font('Helvetica');
          }
          
          let txnDate = 'N/A';
          if (txn.date) {
            try {
              txnDate = new Date(txn.date).toLocaleDateString('en-IN');
            } catch (e) {
              txnDate = 'Invalid';
            }
          }
          
          // Reset X position for each row
          currentX = tableX;
          
          // Date column with proper padding
          doc.text(txnDate, currentX + 3, y + 3, { width: colWidths[0] - 8, ellipsis: true });
          currentX += colWidths[0];
          
          // Amount column with right alignment
          const amountText = `Rs.${Number(txn.amount || 0).toLocaleString('en-IN')}`;
          doc.text(amountText, currentX + 3, y + 3, { width: colWidths[1] - 8, ellipsis: true });
          currentX += colWidths[1];
          
          // Type column with proper padding
          doc.text((txn.type || 'cash').charAt(0).toUpperCase() + (txn.type || 'cash').slice(1), currentX + 3, y + 3, { width: colWidths[2] - 8, ellipsis: true });
          currentX += colWidths[2];
          
          // Method column with proper padding and cleanup
          let methodText = txn.method || 'Cash';
          // Clean up 'advanced_payment' to show proper method
          if (methodText.toLowerCase().includes('advanced_payment') || methodText.toLowerCase().includes('advanced_pay')) {
            methodText = 'Cash';
          }
          doc.text(methodText.charAt(0).toUpperCase() + methodText.slice(1), currentX + 3, y + 3, { width: colWidths[3] - 8, ellipsis: true });
          currentX += colWidths[3];
          
          // Txn Number column with proper padding
          doc.text(txn.txnNumber, currentX + 3, y + 3, { width: colWidths[4] - 8, ellipsis: true });
          currentX += colWidths[4];
          
          // Order No column with proper padding and formatting
          const orderNoText = txn.isAdvanced ? 'Advance' : txn.orderNo;
          doc.text(orderNoText, currentX + 3, y + 3, { width: colWidths[5] - 8, ellipsis: true });
          currentX += colWidths[5];
          
          // Remarks column with proper padding and cleanup
          let remarksText = txn.isAdvanced ? (txn.remarks || 'Advanced payment') : (txn.remarks || 'Payment received');
          // Clean up remarks text for advanced payments
          if (remarksText.includes('Advanced payment allocation: N/A')) {
            remarksText = 'Advanced payment';
          } else if (remarksText.includes('Advanced payment allocation')) {
            remarksText = 'Advanced payment';
          }
          doc.text(remarksText, currentX + 3, y + 3, { width: colWidths[6] - 8, ellipsis: true });
          
          // Move to next row position
          y += 20;
          
          // Add row separator line after each transaction with proper spacing
          doc.moveTo(tableX, y - 2).lineTo(tableX + colWidths.reduce((a, b) => a + b, 0), y - 2).stroke();
        });

        // Remove the final separator line to avoid empty row
        y += 15;
      }



      // Final Summary
      y += 20;
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('LEDGER SUMMARY', 50, y, { align: 'center', width: 500 });
      y += 20;
      
      doc.fontSize(10).font('Helvetica');
      doc.text(`Total Orders: ${orders.length}`, 50, y);
      doc.text(`Total Transactions: ${allTransactions.length}`, 200, y);
      y += 15;
      doc.text(`Total Bill Amount: Rs.${grossBillTotal.toLocaleString('en-IN')}`, 50, y);
      doc.text(`Total Received: Rs.${totalReceivedAmount.toLocaleString('en-IN')}`, 250, y);
      doc.text(`Outstanding Balance: Rs.${outstandingAmount.toLocaleString('en-IN')}`, 400, y);

      y += 30;
      doc.fontSize(8).font('Helvetica');
      doc.text('SUBJECT TO DEHGAM JURISDICTION', 50, y, { width: 500, align: 'center' });
      doc.text('This is a Computer Generated Ledger Report', 50, y + 12, { width: 500, align: 'center' });

      // Finalize the PDF
      doc.end();

    } catch (error) {
      reject(new Error(`PDF generation error: ${error.message}`));
    }
  });
}

// Generate Order Receipt PDF for single or multiple orders
function generateOrderReceiptPDF(orderData, clientData) {
  return new Promise((resolve, reject) => {
    try {
      // Validate input data
      if (!orderData || (!Array.isArray(orderData) && !orderData.orderNo)) {
        return reject(new Error('Invalid order data provided'));
      }

      // Convert single order to array for uniform processing
      const orders = Array.isArray(orderData) ? orderData : [orderData];
      
      if (!clientData || !clientData.name) {
        return reject(new Error('Invalid client data provided'));
      }

      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      
      let buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => {
        try {
          const pdfData = Buffer.concat(buffers);
          if (pdfData.length === 0) {
            return reject(new Error('Generated PDF buffer is empty'));
          }
          resolve(pdfData);
        } catch (err) {
          reject(new Error(`Error concatenating PDF buffer: ${err.message}`));
        }
      });
      
      doc.on('error', (err) => {
        reject(new Error(`PDF generation error: ${err.message}`));
      });

      // Header
      doc.fontSize(20).font('Helvetica-Bold');
      doc.text('RAVI PAVER BLOCK', 50, 50, { align: 'center' });
      doc.fontSize(14).font('Helvetica');
      doc.text(orders.length === 1 ? 'Order Receipt' : 'Multiple Orders Receipt', 50, 80, { align: 'center' });
      
      // Client Information
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(`Client: ${clientData.name || 'N/A'}`, 50, 120);
      doc.fontSize(10).font('Helvetica');
      if (clientData.mobile) doc.text(`Mobile: ${clientData.mobile}`, 50, 140);
      if (clientData.email) doc.text(`Email: ${clientData.email}`, 50, 155);
      
      // Date
      doc.text(`Generated on: ${formatDateConsistent(new Date())}`, 400, 120);
      
      let y = 180;
      let totalAmount = 0;
      let totalPaid = 0;
      let totalRemaining = 0;

      // Process each order
      orders.forEach((order, index) => {
        // Check if we need a new page
        if (y > 650) {
          doc.addPage();
          y = 50;
        }

        // Order header
        doc.fontSize(14).font('Helvetica-Bold');
        doc.text(`Order #${order.orderNo || 'N/A'}`, 50, y);
        
        let orderDate = 'N/A';
        const dateToUse = order.orderDate || order.date;
        if (dateToUse) {
          try {
            orderDate = formatDateConsistent(dateToUse);
          } catch (e) {
            orderDate = 'Invalid Date';
          }
        }
        doc.fontSize(10).font('Helvetica');
        doc.text(`Date: ${orderDate}`, 300, y);
        doc.text(`Status: ${order.orderStatus || 'Active'}`, 450, y);
        
        y += 25;

        // Order details box
        doc.rect(50, y, 500, 80).stroke();
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text('Order Summary:', 60, y + 10);
        
        doc.fontSize(9).font('Helvetica');
        const orderTotal = Number(order.totalAmount || 0);
        const orderPaid = Number(order.totalPaid || 0);
        const orderRemaining = orderTotal - orderPaid;
        
        doc.text(`Total Amount: Rs.${orderTotal.toLocaleString('en-IN')}`, 60, y + 30);
        doc.text(`Amount Paid: Rs.${orderPaid.toLocaleString('en-IN')}`, 200, y + 30);
        doc.text(`Remaining: Rs.${orderRemaining.toLocaleString('en-IN')}`, 350, y + 30);
        
        const paymentStatus = orderRemaining <= 0 ? 'Fully Paid' : orderPaid > 0 ? 'Partially Paid' : 'Unpaid';
        doc.text(`Payment Status: ${paymentStatus}`, 60, y + 50);
        
        if (order.dueDate) {
          try {
            const dueDate = formatDateConsistent(order.dueDate);
            doc.text(`Due Date: ${dueDate}`, 200, y + 50);
          } catch (e) {
            doc.text(`Due Date: Invalid`, 200, y + 50);
          }
        }
        
        y += 90;

        // Products table
        if (order.products && order.products.length > 0) {
          doc.fontSize(11).font('Helvetica-Bold');
          doc.text('Products:', 50, y);
          y += 20;

          // Product table header
          doc.fontSize(8).font('Helvetica-Bold');
          doc.text('Product Name', 60, y);
          doc.text('Quantity', 200, y);
          doc.text('Unit', 260, y);
          doc.text('Rate', 320, y);
          doc.text('Cash Rate', 380, y);
          doc.text('Amount', 450, y);
          
          // Header line
          doc.moveTo(50, y + 12).lineTo(520, y + 12).stroke();
          y += 20;

          // Product rows
          doc.fontSize(7).font('Helvetica');
          order.products.forEach(product => {
            const productAmount = (product.ratePrice || 0) * (product.quantity || 0);
            
            doc.text((product.productName || 'Unknown').substring(0, 25), 60, y);
            doc.text(product.quantity || '0', 200, y);
            doc.text(product.unitTypeLabel || getUnitLabel(product.unitType) || '-', 260, y);
            doc.text(`Rs.${Number(product.ratePrice || 0).toFixed(2)}`, 320, y);
            doc.text(product.cashRate ? `Rs.${Number(product.cashRate).toFixed(2)}` : '-', 380, y);
            doc.text(`Rs.${productAmount.toFixed(2)}`, 450, y);
            y += 12;
          });

          // Product table bottom line
          doc.moveTo(50, y + 5).lineTo(520, y + 5).stroke();
          y += 15;
        }

        // Payment history if available
        if (order.transactions && order.transactions.length > 0) {
          doc.fontSize(11).font('Helvetica-Bold');
          doc.text('Payment History:', 50, y);
          y += 20;

          // Payment table header
          doc.fontSize(8).font('Helvetica-Bold');
          doc.text('Date', 60, y);
          doc.text('Amount', 130, y);
          doc.text('Type', 190, y);
          doc.text('Method', 240, y);
          doc.text('Txn Number', 300, y);
          doc.text('Remarks', 380, y);
          
          // Header line
          doc.moveTo(50, y + 12).lineTo(450, y + 12).stroke();
          y += 20;

          // Payment rows
          doc.fontSize(7).font('Helvetica');
          order.transactions.forEach(txn => {
            let txnDate = 'N/A';
            if (txn.date) {
              try {
                txnDate = new Date(txn.date).toLocaleDateString('en-IN');
              } catch (e) {
                txnDate = 'Invalid';
              }
            }
            
            doc.text(txnDate, 60, y);
            doc.text(`Rs.${Number(txn.amount || 0).toLocaleString('en-IN')}`, 130, y);
            doc.text(txn.transactionType || '-', 190, y);
            doc.text(txn.paymentMethod || '-', 240, y);
            doc.text((txn.txnNumber || '').substring(0, 15), 300, y);
            doc.text((txn.remarks || '').substring(0, 20), 380, y);
            y += 12;
          });

          // Payment table bottom line
          doc.moveTo(50, y + 5).lineTo(450, y + 5).stroke();
          y += 15;
        }

        // Add totals
        totalAmount += orderTotal;
        totalPaid += orderPaid;
        totalRemaining += orderRemaining;

        // Separator between orders
        if (index < orders.length - 1) {
          doc.moveTo(50, y + 10).lineTo(520, y + 10).stroke();
          y += 30;
        }
      });

      // Summary for multiple orders
      if (orders.length > 1) {
        y += 30;
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('TOTAL SUMMARY', 50, y, { align: 'center', width: 500 });
        y += 20;
        
        doc.fontSize(10).font('Helvetica');
        doc.text(`Total Orders: ${orders.length}`, 50, y);
        doc.text(`Total Amount: Rs.${totalAmount.toLocaleString('en-IN')}`, 200, y);
        y += 15;
        doc.text(`Total Paid: Rs.${totalPaid.toLocaleString('en-IN')}`, 50, y);
        doc.text(`Total Outstanding: Rs.${totalRemaining.toLocaleString('en-IN')}`, 200, y);
      }

      y += 40;
      doc.fontSize(8).font('Helvetica');
      doc.text('SUBJECT TO DEHGAM JURISDICTION', 50, y, { width: 500, align: 'center' });
      doc.text('This is a Computer Generated Order Receipt', 50, y + 12, { width: 500, align: 'center' });

      // Finalize the PDF
      doc.end();

    } catch (error) {
      reject(new Error(`PDF generation error: ${error.message}`));
    }
  });
}

// ===============================================
// ===== GENERATE ADVANCED PAYMENT RECEIPT PDF ===
// ===============================================
async function generateAdvancedPaymentReceiptPDF({ advancedPayment, client, order }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      
      let buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => {
        try {
          const pdfData = Buffer.concat(buffers);
          if (pdfData.length === 0) {
            return reject(new Error('Generated PDF buffer is empty'));
          }
          resolve(pdfData);
        } catch (err) {
          reject(new Error(`Error concatenating PDF buffer: ${err.message}`));
        }
      });
      
      doc.on('error', (err) => {
        reject(new Error(`PDF generation error: ${err.message}`));
      });

      // Header
      doc.fontSize(20).font('Helvetica-Bold');
      doc.text('RAVI PAVER BLOCK', 50, 50, { align: 'center' });
      doc.fontSize(16).font('Helvetica-Bold');
      doc.text('ADVANCED PAYMENT RECEIPT', 50, 80, { align: 'center' });
      
      // Receipt details box
      doc.rect(50, 120, 500, 100).stroke();
      
      // Receipt information
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Receipt Details:', 60, 130);
      
      doc.fontSize(10).font('Helvetica');
      doc.text(`Receipt No: AP-${advancedPayment._id.toString().slice(-8)}`, 60, 150);
      doc.text(`Date: ${formatDateConsistent(advancedPayment.date)}`, 300, 150);
      doc.text(`Amount: ₹${Number(advancedPayment.amount).toLocaleString('en-IN')}`, 60, 170);
      doc.text(`Payment Type: ${advancedPayment.transactionType === 'cash' ? 'Cash Payment' : 'Online Payment'}`, 300, 170);
      
      if (advancedPayment.transactionType === 'online') {
        doc.text(`Payment Method: ${advancedPayment.paymentMethod || 'N/A'}`, 60, 190);
        if (advancedPayment.txnNumber) {
          doc.text(`Transaction No: ${advancedPayment.txnNumber}`, 300, 190);
        }
      }
      
      // Client information box
      doc.rect(50, 240, 500, 80).stroke();
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Client Information:', 60, 250);
      
      doc.fontSize(10).font('Helvetica');
      doc.text(`Name: ${client.name || 'N/A'}`, 60, 270);
      doc.text(`Mobile: ${client.mobile || 'N/A'}`, 300, 270);
      if (client.email) {
        doc.text(`Email: ${client.email}`, 60, 290);
      }
      if (client.address) {
        doc.text(`Address: ${client.address}`, 60, 300);
      }
      
      let y = 340;
      
      // Order allocation information (if order is specified)
      if (order) {
        doc.rect(50, y, 500, 80).stroke();
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Order Allocation:', 60, y + 10);
        
        doc.fontSize(10).font('Helvetica');
        doc.text(`Order No: #${order.orderNo}`, 60, y + 30);
        doc.text(`Order Date: ${formatDateConsistent(order.orderDate || order.date)}`, 300, y + 30);
        doc.text(`Order Total: ₹${Number(order.totalAmount || 0).toLocaleString('en-IN')}`, 60, y + 50);
        
        // Calculate allocated amount
        const orderTotal = order.totalAmount || 0;
        const orderPaid = (order.transactions || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const orderRemaining = Math.max(0, orderTotal - orderPaid);
        const amountAllocated = Math.min(advancedPayment.amount, orderRemaining);
        
        doc.text(`Amount Allocated: ₹${amountAllocated.toLocaleString('en-IN')}`, 300, y + 50);
        
        y += 90;
      } else {
        // General advance payment (no specific order)
        doc.rect(50, y, 500, 60).stroke();
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Payment Type:', 60, y + 10);
        
        doc.fontSize(10).font('Helvetica');
        doc.text('General Advance Payment', 60, y + 30);
        doc.text('(Can be allocated to future orders)', 60, y + 45);
        
        y += 70;
      }
      
      // Remarks section (if any)
      if (advancedPayment.remarks && advancedPayment.remarks.trim() !== '') {
        doc.rect(50, y, 500, 50).stroke();
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Remarks:', 60, y + 10);
        
        doc.fontSize(10).font('Helvetica');
        doc.text(advancedPayment.remarks, 60, y + 25, { width: 480 });
        
        y += 60;
      }
      
      // Payment summary box
      y += 20;
      doc.rect(50, y, 500, 80).stroke();
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text('PAYMENT SUMMARY', 60, y + 10);
      
      doc.fontSize(12).font('Helvetica');
      doc.text(`Total Advanced Payment: ₹${Number(advancedPayment.amount).toLocaleString('en-IN')}`, 60, y + 35);
      doc.text(`Remaining Balance: ₹${Number(advancedPayment.remainingAmount).toLocaleString('en-IN')}`, 60, y + 55);
      
      // Amount in words
      const amountInWords = numberToWords(Math.floor(advancedPayment.amount));
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`Amount in Words: ${amountInWords} Rupees Only`, 60, y + 75, { width: 480 });
      
      y += 100;
      
      // Footer
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Thank you for your payment!', 50, y, { align: 'center', width: 500 });
      
      y += 30;
      doc.fontSize(8).font('Helvetica');
      doc.text('SUBJECT TO DEHGAM JURISDICTION', 50, y, { width: 500, align: 'center' });
      doc.text('This is a Computer Generated Advanced Payment Receipt', 50, y + 12, { width: 500, align: 'center' });
      
      // Signature section
      y += 40;
      doc.fontSize(10).font('Helvetica');
      doc.text('Received By: _____________________', 60, y);
      doc.text('Date: _____________________', 350, y);
      
      y += 30;
      doc.text('Signature: _____________________', 60, y);
      doc.text('Stamp: _____________________', 350, y);

      // Finalize the PDF
      doc.end();

    } catch (error) {
      reject(new Error(`Advanced payment PDF generation error: ${error.message}`));
    }
  });
}

// ===============================
// ===== GENERATE INVOICE PDF ====
// ===============================
async function generateInvoicePDF({ order, client, products, transactions }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 20, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      doc.fontSize(16).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
      doc.moveDown(1);

      // Client + Order Info
      let y = drawBorderedTable(doc,
        ['Field', 'Value'],
        [
          ['Order No:', order.orderNo],
          ['Order Date:', formatDateConsistent(order.orderDate || order.date)],
          ['Due Date:', formatDateConsistent(order.dueDate)],
          ['Client Name:', client.name || 'N/A'],
          ['Email:', client.email || 'N/A'],
          ['Client ID:', client._id]
        ],
        [150, 350], 20, 80, { align: ['left', 'left'] }
      );

      // Products Table
      const productRows = (products || []).map(p => [
        p.name || 'N/A',
        p.quantity || '',
        p.unitType || '-',
        formatCurrency(p.ratePrice || p.amount / (p.quantity || 1)),
        formatCurrency(p.amount)
      ]);
      y = drawBorderedTable(doc, ['Product Name', 'Qty', 'Unit', 'Rate', 'Amount'], productRows, [200, 60, 60, 80, 80], 20, y + 10, { align: ['left', 'center', 'center', 'right', 'right'] });

      const subtotal = products.reduce((sum, p) => sum + (p.amount || 0), 0);
      const gstEnabled = false; // GST is not enabled in this example
      const gstRate = parseFloat(order.gst) || 0;
      const gstAmount = gstEnabled && gstRate > 0 ? (subtotal * gstRate / 100) : 0;
      const grandTotal = subtotal + gstAmount;
      
      // Payment Summary
      drawBorderedTable(doc, ['Label', 'Amount'], [
        ['Subtotal:', formatCurrency(subtotal)],
        ['Final Total:', formatCurrency(subtotal)],
        ['Total Paid:', formatCurrency(transactions.reduce((sum, t) => sum + (t.amount || 0), 0))],
        ['Balance:', formatCurrency(grandTotal - transactions.reduce((sum, t) => sum + (t.amount || 0), 0))]
      ], [200, 100], 300, y + 10);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ========================================
// ===== GENERATE TRANSACTION RECEIPT =====
// ========================================
async function generateTransactionReceiptPDF({ transaction, order, client, products }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 20, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      doc.fontSize(16).font('Helvetica-Bold').text('PAYMENT RECEIPT', { align: 'center' });
      doc.moveDown(1);

      // Receipt Info
      let y = drawBorderedTable(doc, ['Field', 'Value'], [
        ['Receipt No:', transaction._id],
        ['Date:', formatDateConsistent(transaction.date)],
        ['Client Name:', client.name || 'N/A'],
        ['Email:', client.email || 'N/A'],
        ['Order No:', order.orderNo],
        ['Order Date:', new Date(order.orderDate || order.date).toLocaleDateString()]
      ], [150, 350], 20, 80);

      // Products
      const rows = (products || []).map(p => [
        p.name || 'N/A',
        p.quantity || '',
        p.unitType || '-',
        formatCurrency(p.amount || 0)
      ]);
      y = drawBorderedTable(doc, ['Product Name', 'Qty', 'Unit', 'Amount'], rows, [200, 60, 60, 80], 20, y + 10, { align: ['left', 'center', 'center', 'right'] });

      // Payment Info
      drawBorderedTable(doc, ['Label', 'Amount'], [
        ['Paid Amount:', formatCurrency(transaction.amount)]
      ], [200, 100], 300, y + 10);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ===================================
// ===== CONTINUOUS TABLE DRAWING ===
// ===================================
function drawContinuousTable(doc, sections, startX, startY, options = {}) {
  const { padding = 4, headerFontSize = 9, fontSize = 7 } = options;
  
  let currentY = startY;
  
  // Calculate total height for all sections
  let totalHeight = 0;
  sections.forEach(section => {
    const headerHeight = (section.headers && section.headers.length > 0) ? 15 : 0;
    totalHeight += (section.rows.length * 15) + headerHeight;
  });
  
  // Find the maximum table width among all sections
  const tableWidth = Math.max(...sections.map(section => section.colWidths.reduce((a, b) => a + b, 0)));
  
  // Draw top, left, and right borders
  doc.moveTo(startX, currentY).lineTo(startX + tableWidth, currentY).stroke(); // top
  doc.moveTo(startX, currentY).lineTo(startX, currentY + totalHeight).stroke(); // left
  doc.moveTo(startX + tableWidth, currentY).lineTo(startX + tableWidth, currentY + totalHeight).stroke(); // right
  
  // Draw continuous vertical lines for entire table (use the widest section for reference)
  const maxWidthSection = sections.find(section => section.colWidths.reduce((a, b) => a + b, 0) === tableWidth);
  let x = startX;
  for (let i = 0; i < maxWidthSection.colWidths.length; i++) {
    x += maxWidthSection.colWidths[i];
    if (i < maxWidthSection.colWidths.length - 1) {
      doc.moveTo(x, currentY).lineTo(x, currentY + totalHeight).stroke();
    }
  }
  
  // Draw each section
  sections.forEach((section, sectionIndex) => {
    const { headers, rows, colWidths } = section;
    
    // Draw header row only if headers exist
    if (headers && headers.length > 0) {
      currentY += 2;
      doc.fontSize(headerFontSize).font('Helvetica-Bold');
      
      let headerX = startX;
      for (let i = 0; i < headers.length; i++) {
        if (headers[i]) {
          doc.text(headers[i], headerX + padding, currentY, { width: colWidths[i] - padding * 2 });
        }
        headerX += colWidths[i];
      }
      
      currentY += 15;
      // Draw horizontal line after header (only for right columns for first 3 sections, full width for products)
      if (sectionIndex < 3 && colWidths.length > 1) {
        // For company/consignee/buyer sections - only right columns
        doc.moveTo(startX + colWidths[0], currentY - 2).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), currentY - 2).stroke();
      } else if (sectionIndex >= 3) {
        // For products section - full width
        doc.moveTo(startX, currentY - 2).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), currentY - 2).stroke();
      }
    }
    
    // Draw data rows
    doc.fontSize(fontSize).font('Helvetica');
    
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      let rowX = startX;
      
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        if (row[colIndex]) {
          // Special formatting for different columns and content
          if (colIndex === 0 && (row[colIndex].includes('Name:') || rowIndex === 0 || row[colIndex].includes('RAVI PRECAST'))) {
            // First column headers - bold
            doc.fontSize(8).font('Helvetica-Bold');
            doc.text(row[colIndex], rowX + padding + 2, currentY + 2, { width: colWidths[colIndex] - padding * 2 });
            doc.fontSize(fontSize).font('Helvetica');
          } else if (colIndex > 0 && (row[colIndex].includes('Invoice No.') || row[colIndex].includes('Dated') || 
                     row[colIndex].includes('Reference No.') || row[colIndex].includes('Dispatched through') ||
                     row[colIndex].includes('Buyer\'s Order No.') || row[colIndex].includes('Dispatch Doc No.') ||
                     row[colIndex].includes('Destination') || row[colIndex].includes('Motor Vehicle No.'))) {
            // Right column key-value pairs - make keys bold
            const text = row[colIndex];
            const parts = text.split(' - ');
            if (parts.length === 2) {
              // Draw key in bold
              doc.fontSize(fontSize).font('Helvetica-Bold');
              const keyWidth = doc.widthOfString(parts[0] + ' - ');
              doc.text(parts[0] + ' - ', rowX + padding + 2, currentY + 2, { width: colWidths[colIndex] - padding * 2 });
              
              // Draw value in normal font
              doc.fontSize(fontSize).font('Helvetica');
              doc.text(parts[1], rowX + padding + 2 + keyWidth, currentY + 2, { width: colWidths[colIndex] - padding * 2 - keyWidth });
            } else {
              doc.fontSize(fontSize).font('Helvetica');
              doc.text(text, rowX + padding + 2, currentY + 2, { width: colWidths[colIndex] - padding * 2 });
            }
          } else {
            // Regular text with better padding
            doc.fontSize(fontSize).font('Helvetica');
            doc.text(row[colIndex], rowX + padding + 2, currentY + 2, { width: colWidths[colIndex] - padding * 2 });
          }  
        }
        rowX += colWidths[colIndex];
      }
      
      currentY += 15;
      
      // Draw horizontal lines based on section type
      if (rowIndex < rows.length - 1) {
        if (sectionIndex < 3 && colWidths.length > 1) {
          // For company/consignee/buyer sections - only right columns
          doc.moveTo(startX + colWidths[0], currentY - 2).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), currentY - 2).stroke();
        } else if (sectionIndex >= 3) {
          // For products section - full width horizontal lines
          doc.moveTo(startX, currentY - 2).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), currentY - 2).stroke();
        }
      }
    }
    
    // Draw section divider (except for last section)
    if (sectionIndex < sections.length - 1) {
      doc.moveTo(startX, currentY - 2).lineTo(startX + tableWidth, currentY - 2).stroke();
    }
  });
  
  // Draw bottom border to connect with next table
  doc.moveTo(startX, currentY).lineTo(startX + tableWidth, currentY).stroke();
  
  return currentY;
}

// ===================================
// ===== CONNECTED TABLE DRAWING ====
// ===================================
function drawConnectedTable(doc, headers, rows, colWidths, startX, startY, options = {}) {
  const { padding = 4, align = [], headerFont = 'Helvetica-Bold', rowFont = 'Helvetica', fontSize = 7, headerFontSize = 8 } = options;
  let y = startY;

  // Draw header row if headers exist (no top border)
  if (headers && headers.length > 0 && headers.some(h => h)) {
    let x = startX;
    doc.font(headerFont).fontSize(headerFontSize).fillColor('#000');
    
    // Calculate header height based on content
    let headerHeight = 20;
    headers.forEach((header, i) => {
      if (header && header.includes('\n')) {
        headerHeight = Math.max(headerHeight, 24);
      }
    });
    
    headers.forEach((header, i) => {
      // Draw left, right, and bottom borders for header (no top border)
      doc.moveTo(x, y).lineTo(x, y + headerHeight).stroke(); // left
      doc.moveTo(x + colWidths[i], y).lineTo(x + colWidths[i], y + headerHeight).stroke(); // right
      doc.moveTo(x, y + headerHeight).lineTo(x + colWidths[i], y + headerHeight).stroke(); // bottom
      
      // Calculate vertical centering for header text
      const textHeight = doc.heightOfString(header || '', { width: colWidths[i] - padding * 2 });
      const verticalOffset = (headerHeight - textHeight) / 2;
      
      doc.text(header || '', x + padding, y + verticalOffset, { 
        width: colWidths[i] - padding * 2, 
        align: align[i] || 'left',
        lineGap: 0
      });
      x += colWidths[i];
    });
    y += headerHeight;
  }

  // Draw data rows with proper padding
  doc.font(rowFont).fontSize(fontSize).fillColor('#000');
  rows.forEach((row, rowIndex) => {
    let rowHeight = 14;
    row.forEach((cell, i) => {
      const cellHeight = doc.heightOfString(String(cell || ''), { width: colWidths[i] - padding * 2, fontSize });
      rowHeight = Math.max(rowHeight, Math.min(cellHeight + padding * 2, 20));
    });

    let xPos = startX;
    row.forEach((cell, i) => {
      doc.rect(xPos, y, colWidths[i], rowHeight).stroke();
      
      // Check if this is an important field and make it bold
      const cellText = String(cell || '');
      const isImportantField = cellText.includes('GSTIN') || cellText.includes('State Name') || 
                               cellText.includes('RAVI PRECAST') || cellText.includes('Total') ||
                               cellText.includes('Declaration') || cellText.includes("Company's Bank Details") ||
                               cellText.includes('Limbadiya gam') || cellText.includes('By Road');
      
      if (isImportantField) {
        doc.font('Helvetica-Bold').fontSize(fontSize + 1);
      } else {
        doc.font(rowFont).fontSize(fontSize);
      }
      
      doc.text(cellText, xPos + padding, y + padding, { 
        width: colWidths[i] - padding * 2, 
        align: align[i] || 'left',
        lineGap: -1
      });
      xPos += colWidths[i];
    });
    y += rowHeight;
  });

  return y;
}

// ===================================
// ===== GENERATE DISPATCH PDF =======
// ===================================
async function generateDispatchPDF({ order, client, dispatchInfo, dispatchedProducts }) {
  return new Promise((resolve, reject) => {
    try {
      // Debug logging to see what data we're receiving
      console.log('=== PDF Generation Debug ===');
      console.log('dispatchInfo:', JSON.stringify(dispatchInfo, null, 2));
      console.log('dispatchInfo.buyer:', JSON.stringify(dispatchInfo?.buyer, null, 2));
      console.log('dispatchInfo.consignee:', JSON.stringify(dispatchInfo?.consignee, null, 2));
      
      // Helper function to safely get non-empty values
      const getSafeValue = (value) => (value && value.trim() !== '') ? value.trim() : '';
      
      const doc = new PDFDocument({ margin: 20, size: 'A4' });
      
      // Register Gujarati font for proper Unicode support
      try {
        const gujaratiFontPath = path.join(__dirname, '..', 'fonts', 'NotoSansGujarati-Regular.ttf');
        if (fs.existsSync(gujaratiFontPath)) {
          doc.registerFont('GujaratiFont', gujaratiFontPath);
        }
      } catch (fontError) {
        console.log('Gujarati font not available, using fallback');
      }
      
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Outer page border
      doc.save();
      doc.lineWidth(1).strokeColor('#000');
      doc.rect(20, 20, 555, 802).stroke();
      doc.restore();
      doc.strokeColor('black').lineWidth(1);

      // Header - with proper padding
      doc.fontSize(12).font('Helvetica-Bold').text('TAX INVOICE', 50, 30, { width: 455, align: 'center' });
      doc.fontSize(8).font('Helvetica').text('(ORIGINAL FOR RECIPIENT)', 420, 30, { width: 125, align: 'right' });

      let y = 50;

      // Top section - 2 column layout (no headers)
      const topHeaders = [];  // No headers at all
      
      // Use consistent date formatting function
      
      const topData = [
        ['RAVI PRECAST', `Invoice No. - DISP-${order.orderNo}`],
        ['Jaliyamath, Block/Ser.No-125002', `Dated - ${formatDateConsistent(dispatchInfo.date)}`],
        ['Jaliyamath Village, Dehgam-Rakhiyal Road', `Mode/Terms of Payment - 15 Days`],
        ['Mo. 9726965264 / 9825308702', `Reference No. & Date - 04 dt. ${formatDateConsistent(dispatchInfo.date)}`],
        ['MSME / UDYAM-GJ-09-0005739', 'Dispatched through - By Vehicle'],
        ['State Name : Gujarat, Code : 24', ''],
        ['GSTIN/UIN : 24ABEFR9076Q1ZC', '']
      ];

      // Define all sections for continuous table - 2 column layout for middle section
      const middleHeaders = [];  // No headers at all
      
      // Safe data extraction with error handling
      let buyerOrderNo, dispatchDate, dispatchDocNo, dispatchMethod, destination, vehicleNo;
      
      try {
        buyerOrderNo = getSafeValue(order.orderNo) || '04';
        // Use order creation date, not dispatch date
        dispatchDate = formatDateConsistent(order.createdAt || order.orderDate || order.date);
        dispatchDocNo = getSafeValue(order.orderNo) || '05';
        dispatchMethod = getSafeValue(dispatchInfo.type) || 'By Road';
        destination = getSafeValue(dispatchInfo.address) || getSafeValue(dispatchInfo.consignee?.consigneeAddress) || 'Sargasan, Gandhinagar, Gujarat, India';
        vehicleNo = (getSafeValue(dispatchInfo.vehicleNo) || 'GJ22DJD').toString().toUpperCase();
        
        console.log('PDF Data Debug - Order Date:', { 
          orderCreatedAt: order.createdAt, 
          orderDate: order.orderDate, 
          orderDateField: order.date,
          dispatchInfoDate: dispatchInfo.date,
          finalDispatchDate: dispatchDate 
        });
      } catch (error) {
        console.error('Error preparing middle section data:', error);
        // Fallback values
        buyerOrderNo = '04';
        dispatchDate = formatDateConsistent(order.createdAt || order.orderDate || order.date);
        dispatchDocNo = '05';
        dispatchMethod = 'By Road';
        destination = 'Sargasan, Gandhinagar, Gujarat, India';
        vehicleNo = 'GJ22DJD';
      }
      
      const middleData = [
        ['Consignee (Ship to)', `Buyer's Order No. - ${buyerOrderNo}`],
        [getSafeValue(dispatchInfo.consignee?.consigneeName), `Dated - ${dispatchDate}`],
        [getSafeValue(dispatchInfo.consignee?.consigneeAddress), `Dispatch Doc No. - ${dispatchDocNo}`],
        [getSafeValue(dispatchInfo.consignee?.consigneeContact), `Dispatched through - ${dispatchMethod}`],
        [getSafeValue(dispatchInfo.consignee?.consigneeState) ? `State Name: ${getSafeValue(dispatchInfo.consignee.consigneeState)}` : 'State Name: Gujarat', `Destination - ${destination}`],
        ['', `Motor Vehicle No. - ${vehicleNo}`]
      ];

      const buyerHeaders = ['Buyer (Bill to)', 'Terms of Delivery'];
      const buyerData = [
        [getSafeValue(dispatchInfo.buyer?.buyerName) || getSafeValue(client?.name) || '', 'With Unloading, Within 5 Feet to Truck'],
        [getSafeValue(dispatchInfo.buyer?.buyerAddress), ''],
        [getSafeValue(dispatchInfo.buyer?.buyerContact), ''],
        [getSafeValue(dispatchInfo.buyer?.buyerState) ? `State Name: ${getSafeValue(dispatchInfo.buyer.buyerState)}` : '', '']
      ];

      // Create sections array for continuous table
      const tableSections = [
        {
          headers: topHeaders,
          rows: topData,
          colWidths: [277, 278]  // 2 columns: left company info, right key-value pairs
        },
        {
          headers: middleHeaders,
          rows: middleData,
          colWidths: [277, 278]  // 2 columns: left consignee info, right key-value pairs
        },
        {
          headers: buyerHeaders,
          rows: buyerData,
          colWidths: [277, 278]
        }
      ];

      // Products table data
      const productHeaders = ['Sl\nNo.', 'Description of Goods', 'HSN/SAC', 'Quantity', 'Rate', 'No.of pcs', 'Amount'];
      const productRows = (dispatchedProducts || []).map((p, i) => {
        const quantity = Number(p.quantity || 0);
        const numberOfItems = p.numberOfItems || 1;
        const totalNumber = quantity * numberOfItems;
        
        // Get product name from order products using productId
        let productName = p.name || p.productName || '';
        
        if (!productName && p.productId && order.products) {
          const orderProduct = order.products.find(op => String(op.productId) === String(p.productId));
          if (orderProduct && orderProduct.productName) {
            productName = orderProduct.productName;
          }
        }
        
        // Fallback to a generic name if still empty
        if (!productName) {
          productName = `Product ${i + 1}`;
        }
        
        return [
          (i + 1).toString(),
          productName,
          '68101190',
          `${quantity.toFixed(2)} ${getUnitLabel(p.unitType)}`,
          `Rs.${Number(p.ratePrice || 0).toFixed(2)}`,
          `${totalNumber}`,
          `Rs.${Number(p.amount || 0).toFixed(2)}`
        ];
      });

      // Draw continuous table with the first 3 sections only
      y = drawContinuousTable(doc, tableSections, 20, y, { headerFontSize: 9 });

      // Draw products table directly connected (no gap, no top border)
      y = drawConnectedTable(doc, productHeaders, productRows, [32, 190, 62, 78, 68, 52, 73], 20, y, 
        { align: ['center','left','center','center','right','center','right'], headerFontSize: 9, padding: 5 });

      // Calculate totals with conditional GST from order
      const subtotal = dispatchedProducts.reduce((s, p) => s + (p.amount || 0), 0);
      const gstRate = parseFloat(order.gst) || 0;
      const gstAmount = gstRate > 0 ? (subtotal * gstRate / 100) : 0;
      const grandTotal = subtotal + gstAmount;
      
      console.log(`PDF GST Calculation - Order GST Rate: ${gstRate}%, Subtotal: ${subtotal}, GST Amount: ${gstAmount}, Grand Total: ${grandTotal}`);

      const totalsByUnit = (dispatchedProducts || []).reduce((acc, p) => {
        const u = p.unitType || '-';
        const q = Number(p.quantity || 0);
        acc[u] = (acc[u] || 0) + q;
        return acc;
      }, {});
      const totalQty = Object.values(totalsByUnit).reduce((a, b) => a + Number(b || 0), 0);

      // Calculate total number of pieces with error handling
      let totalPieces = 0;
      try {
        totalPieces = (dispatchedProducts || []).reduce((total, p) => {
          const quantity = Number(p.quantity || 0);
          const numberOfItems = Number(p.numberOfItems || 1);
          const pieces = quantity * numberOfItems;
          return total + (isNaN(pieces) ? 0 : pieces);
        }, 0);
      } catch (error) {
        console.error('Error calculating total pieces:', error);
        totalPieces = 0;
      }

      // Tax rows - conditionally include GST row based on order's GST
      const taxRows = [];
      
      // Only add GST row if order has GST applied
      if (gstRate > 0) {
        taxRows.push(
          ['', `${gstRate}% GST`, '', '', `${gstRate} %`, '', `Rs.${gstAmount.toFixed(2)}`]
        );
      }
      
      // Always add the total row with quantity in HSN/SAC column and total pieces in No.of pcs column
      console.log(`PDF Total Calculation - Total Qty: ${totalQty}, Total Pieces: ${totalPieces}, Grand Total: ${grandTotal}`);
      taxRows.push(
        ['', 'Total', `${totalQty.toFixed(2)} ${Object.keys(totalsByUnit).map(u => getUnitLabel(u)).join(', ')}`, '', '', `${totalPieces}`, `Rs.${grandTotal.toFixed(2)}`]
      );

      // Draw tax table if there are rows to display
      if (taxRows.length > 0) {
        // Draw GST rows normally (if any)
        const gstRows = taxRows.filter(row => row[1].includes('GST'));
        const totalRows = taxRows.filter(row => row[1] === 'Total');
        
        // Draw GST rows with normal borders
        if (gstRows.length > 0) {
          y = drawBorderedTable(doc, [], gstRows, [32, 190, 62, 78, 68, 52, 73], 20, y, 
            { align: ['center','left','center','center','right','center','right'], padding: 5 });
        }
        
        // Draw Total row with merged quantity cell but keep column separators
        if (totalRows.length > 0) {
          const totalRow = totalRows[0];
          const colWidths = [32, 190, 62, 78, 68, 52, 73];
          const startX = 20;
          const rowHeight = 14;
          const padding = 5;
          
          // Draw outer border
          const totalWidth = colWidths.reduce((sum, width) => sum + width, 0);
          doc.rect(startX, y, totalWidth, rowHeight).stroke();
          
          // Draw vertical separators for columns (keep column structure)
          let xPos = startX;
          for (let i = 0; i < colWidths.length - 1; i++) {
            xPos += colWidths[i];
            // Skip drawing separator between Description and HSN/SAC columns (index 1-2) only
            if (i !== 1) {
              doc.moveTo(xPos, y).lineTo(xPos, y + rowHeight).stroke();
            }
          }
          
          // Draw text content
          xPos = startX;
          totalRow.forEach((cell, i) => {
            if (cell && cell.trim() !== '') {
              let textWidth = colWidths[i] - padding * 2;
              let textX = xPos + padding;
              
              // For "Total" text (index 1), keep it in Description column only
              if (i === 1) {
                textWidth = colWidths[1] - padding * 2;
                textX = startX + colWidths[0] + padding; // Position in Description column
              }
              
              // For quantity text (index 2), position it in HSN/SAC column
              if (i === 2) {
                textWidth = colWidths[2] - padding * 2;
                textX = startX + colWidths[0] + colWidths[1] + padding; // Position in HSN/SAC column
              }
              
              // For total pieces (index 5), position it in No.of pcs column
              if (i === 5 && colWidths.length > 5) {
                textWidth = colWidths[5] - padding * 2;
                textX = startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + padding; // Position in No.of pcs column
              }
              
              const align = ['center','left','center','center','right','center','right'][i] || 'left';
              doc.font('Helvetica-Bold').fontSize(7);
              doc.text(String(cell), textX, y + padding, { 
                width: textWidth, 
                align: align,
                lineGap: -1
              });
            }
            xPos += colWidths[i];
          });
          
          y += rowHeight;
        }
      }

      // Amount in words - with proper padding
      doc.fontSize(8).font('Helvetica-Bold').text('Amount Chargeable (in words)', 25, y + 8);
      doc.font('Helvetica').fontSize(7).text(`Rs.${numberToWords(Math.round(grandTotal))} Only`, 220, y + 8);

      // Footer sections - Declaration and Terms & Conditions (removed bank details)
      const footerY = y + 30;
      const leftColumnWidth = 277;
      const rightColumnWidth = 278;
      const startX = 20;
      
      // Draw the main border
      doc.rect(startX, footerY, leftColumnWidth + rightColumnWidth, 120).stroke();
      
      // Draw vertical divider
      doc.moveTo(startX + leftColumnWidth, footerY).lineTo(startX + leftColumnWidth, footerY + 120).stroke();
      
      // Draw header row
      doc.rect(startX, footerY, leftColumnWidth + rightColumnWidth, 20).stroke();
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('Declaration', startX + 5, footerY + 6, { width: leftColumnWidth - 10, align: 'center' });
      doc.text('Terms & Conditions', startX + leftColumnWidth + 5, footerY + 6, { width: rightColumnWidth - 10, align: 'center' });
      
      // Declaration content
      doc.fontSize(7).font('Helvetica');
      doc.text('You are requested to verify and calculate the goods then sign below. No argument will be valid later.', 
               startX + 5, footerY + 30, { width: leftColumnWidth - 10 });
      
      doc.text("Customer's Seal and Signature", startX + 5, footerY + 90, { width: leftColumnWidth - 10 });
      
      // Use Gujarati font if available
      const useGujaratiFont = fs.existsSync(path.join(__dirname, '..', 'fonts', 'NotoSansGujarati-Regular.ttf'));
      
      // Terms & Conditions section - optimized layout with larger font
      doc.fontSize(8).font(useGujaratiFont ? 'GujaratiFont' : 'Helvetica');
      
      let termsY = footerY + 25;
      
      // Combined Terms & Conditions text as single continuous block
      const termsText = `અમો ઉપર સહી કરનારે મટીરીયલ જોઈ, ચકાસી, ગણતરી કરી ને સહી કરેલ છે. લુઝ મટીરીયલ માં 5% અને પેકીંગ મટીરીયલ માં 3% ભાંગ-તૂટ ની છૂટ ટ્રાન્સપોર્ટ નિયમ અનુસાર માન્ય રાખવામાં આવે છે. જો તેનાથી વધારે પ્રમાણમાં ભાંગ-તૂટ જણાય તો (બિલ કોપી ઉપર) લેખિતમાં જાણ કરવી. એક વખત માલ મેળવી લીધા બાદ પાછળ થી કોઈ દલીલ સાંભળવામાં આવશે નહિ. પેવર બ્લોક માં 5mm સુધી થિકનેશ વેરિએશન માન્ય રહેશે. મટીરીયલ 5 ફૂટ થી દૂર ઉતારી આપવાંમાં આવશે નહિ. વચ્ચે કોઈ પણ પ્રકારની અડચણ હશે તો તે અડચણ માલ લેનારે દૂર કરવાની રહેશે. માલ ઉતારવામાં જો કોઈ દીવાલ, પગથિયાં, ગટર કે કોઈ અડચણ રૂપ વસ્તુ ને પાર કરી સામાન ઉતારી આપવા માં આવશે નહિ. મટીરીયલ લેનાર ના હદમાં જો વિહિકલ ફસાઈ જાય તો તેને બહાર કાઢવાની જવાબદારી માલ લેનાર ની રહેશે. વધેલું મટીરીયલ પાછું લેવામાં આવશે નહિ.`;
      
      // Render continuous text with minimal spacing
      doc.text(termsText, 
               startX + leftColumnWidth + 3, termsY, { 
                 width: rightColumnWidth - 6,
                 lineGap: 0,
                 align: 'justify'
               });
      
      // Calculate height of rendered text to position next elements
      const textHeight = doc.heightOfString(termsText, {
        width: rightColumnWidth - 6,
        lineGap: 0
      });
      
      termsY += textHeight + 5;
      
      // Jurisdiction note
      doc.fontSize(6).font('Helvetica-Bold');
      doc.text('All Disputes Subject to Dehgam Jurisdiction Only.', 
               startX + leftColumnWidth + 3, termsY, { 
                 width: rightColumnWidth - 6,
                 align: 'center'
               });

      y = footerY + 120;

      // Final footer - compact
      doc.fontSize(6).text('SUBJECT TO DEHGAM JURISDICTION', 20, y + 5, { width: 555, align: 'center' });
      doc.text('This is a Computer Generated Invoice', 20, y + 15, { width: 555, align: 'center' });

      doc.end();
    } catch (err) {
    }
  });
}

// Generate Advanced Payment Receipt PDF
async function generateAdvancedPaymentReceiptPDF(data) {
  const { advancedPayment, client, order } = data;
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Check for Gujarati font
      const useGujaratiFont = fs.existsSync(path.join(__dirname, '../fonts/NotoSansGujarati-Regular.ttf'));
      
      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('ADVANCED PAYMENT RECEIPT', 50, 50, { align: 'center' });
      doc.fontSize(12).font('Helvetica').text('Ravi Paver Block', 50, 80, { align: 'center' });
      doc.text('Advanced Payment Acknowledgment', 50, 100, { align: 'center' });
      
      // Receipt details
      let yPos = 140;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`Receipt No: AP-${advancedPayment._id.slice(-8).toUpperCase()}`, 50, yPos);
      doc.text(`Date: ${formatDateConsistent(advancedPayment.date)}`, 350, yPos);
      
      yPos += 30;
      
      // Client Information
      doc.fontSize(12).font('Helvetica-Bold').text('Client Information:', 50, yPos);
      yPos += 20;
      doc.fontSize(10).font('Helvetica');
      doc.text(`Name: ${client.name}`, 50, yPos);
      yPos += 15;
      doc.text(`Mobile: ${client.mobile}`, 50, yPos);
      yPos += 15;
      if (client.email) {
        doc.text(`Email: ${client.email}`, 50, yPos);
        yPos += 15;
      }
      
      yPos += 20;
      
      // Payment Information
      doc.fontSize(12).font('Helvetica-Bold').text('Payment Details:', 50, yPos);
      yPos += 20;
      doc.fontSize(10).font('Helvetica');
      doc.text(`Amount Received: ${formatCurrency(advancedPayment.amount)}`, 50, yPos);
      yPos += 15;
      doc.text(`Payment Type: ${advancedPayment.transactionType === 'cash' ? 'Cash' : 'Online'}`, 50, yPos);
      yPos += 15;
      
      if (advancedPayment.transactionType === 'online') {
        doc.text(`Payment Method: ${advancedPayment.paymentMethod?.replace('_', ' ').toUpperCase()}`, 50, yPos);
        yPos += 15;
        if (advancedPayment.txnNumber) {
          doc.text(`Transaction Number: ${advancedPayment.txnNumber}`, 50, yPos);
          yPos += 15;
        }
      }
      
      if (advancedPayment.remarks) {
        doc.text(`Remarks: ${advancedPayment.remarks}`, 50, yPos);
        yPos += 15;
      }
      
      yPos += 20;
      
      // Order allocation if applicable
      if (order) {
        doc.fontSize(12).font('Helvetica-Bold').text('Order Allocation:', 50, yPos);
        yPos += 20;
        doc.fontSize(10).font('Helvetica');
        doc.text(`Order Number: ${order.orderNo}`, 50, yPos);
        yPos += 15;
        doc.text(`Order Date: ${formatDateConsistent(order.orderDate || order.date)}`, 50, yPos);
        yPos += 15;
        doc.text(`Order Total: ${formatCurrency(order.totalAmount)}`, 50, yPos);
        yPos += 30;
      }
      
      // Amount in words
      const amountInWords = numberToWords(Math.floor(advancedPayment.amount));
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`Amount in Words: ${amountInWords} Rupees Only`, 50, yPos);
      yPos += 30;
      
      // Usage status
      doc.fontSize(10).font('Helvetica');
      doc.text(`Remaining Balance: ${formatCurrency(advancedPayment.remainingAmount)}`, 50, yPos);
      yPos += 15;
      doc.text(`Status: ${advancedPayment.status.toUpperCase()}`, 50, yPos);
      yPos += 40;
      
      // Terms and conditions
      doc.fontSize(8).font('Helvetica');
      if (useGujaratiFont) {
        doc.font(path.join(__dirname, '../fonts/NotoSansGujarati-Regular.ttf'));
      }
      
      const terms = [
        '• This advance payment is adjustable against future orders.',
        '• Advance payments are non-refundable except in special circumstances.',
        '• This receipt should be retained for your records.',
        '• Any disputes should be reported within 7 days of receipt.'
      ];
      
      doc.text('Terms & Conditions:', 50, yPos);
      yPos += 15;
      terms.forEach(term => {
        doc.text(term, 50, yPos);
        yPos += 12;
      });
      
      // Signature section
      yPos += 30;
      doc.fontSize(10).font('Helvetica');
      doc.text('Received by:', 50, yPos);
      doc.text('Authorized Signature:', 350, yPos);
      yPos += 40;
      doc.text('_________________', 50, yPos);
      doc.text('_________________', 350, yPos);
      
      // Footer
      doc.fontSize(8).font('Helvetica').fillColor('#666');
      doc.text('Thank you for your business!', 50, doc.page.height - 50, { align: 'center' });
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateClientLedgerPDF,
  generateOrderReceiptPDF,
  generateInvoicePDF,
  generateTransactionReceiptPDF,
  generateDispatchPDF,
  generateAdvancedPaymentReceiptPDF,
  getUnitLabel
};
