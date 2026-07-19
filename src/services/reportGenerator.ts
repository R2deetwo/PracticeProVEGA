
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FirmDetails, Invoice, Contact, TimesheetData, ReportDateRangeOption, UtilizationData, MatterStatusReportData, ProfitLossData, ArAgingData, Property } from '../types';
import { formatNaira } from '../utils/formatting';

const A4_WIDTH = 210;
const A4_HEIGHT = 297;
const MARGIN = 15;
const FONT_SIZE_NORMAL = 10;
const FONT_SIZE_LARGE = 22; // Increased to match preview
const FONT_SIZE_SMALL = 8;
const LINE_HEIGHT = 1.5;

const getDateRangeString = (dateRange: ReportDateRangeOption): string => {
    const end = new Date();
    const start = new Date();
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

    switch (dateRange) {
        case 'last_30':
            start.setDate(end.getDate() - 30);
            return `For the Period: ${start.toLocaleDateString('en-GB', options)} to ${end.toLocaleDateString('en-GB', options)}`;
        case 'last_90':
            start.setDate(end.getDate() - 90);
            return `For the Period: ${start.toLocaleDateString('en-GB', options)} to ${end.toLocaleDateString('en-GB', options)}`;
        case 'this_year':
            return `For the Year ${end.getFullYear()}`;
        case 'all_time':
            return 'For All Time';
    }
};

const getAsOfDateString = () => `As of ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;

// --- BASE PDF SETUP ---
const createPdf = (firmDetails: FirmDetails, title: string, subtitle?: string): { doc: jsPDF, y: number } => {
    const doc = new jsPDF('p', 'mm', 'a4');
    let y = MARGIN;

    // --- LETTERHEAD LOGIC ---
    if (firmDetails.letterheadUrl) {
        try {
            // Add full page letterhead image
            // Assuming letterheadUrl is a base64 data URI (which it is from the file reader)
            doc.addImage(firmDetails.letterheadUrl, 'JPEG', 0, 0, A4_WIDTH, A4_HEIGHT);

            // Render the text header ON TOP of the image
            y = renderTextHeader(doc, firmDetails, y);
        } catch (e) {
            console.error("Could not add letterhead to PDF:", e);
            // Fallback to text header if image fails
            y = renderTextHeader(doc, firmDetails, y);
        }
    } else {
        // No letterhead image, render standard text header
        y = renderTextHeader(doc, firmDetails, y);
    }

    // Title
    if (title) {
        doc.setTextColor(0); // Ensure black text for body title
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(title, A4_WIDTH / 2, y, { align: 'center' });
        y += 7;
    }

    // Subtitle (for dates)
    if (subtitle) {
        doc.setFontSize(FONT_SIZE_NORMAL);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100); // Gray color
        doc.text(subtitle, A4_WIDTH / 2, y, { align: 'center' });
        y += 10;
        doc.setTextColor(0); // Reset to black
    } else if (title) {
        y += 5; // Maintain some space if no subtitle
    }

    doc.setFontSize(FONT_SIZE_NORMAL);
    doc.setFont('helvetica', 'normal');

    return { doc, y };
};

const renderTextHeader = (doc: jsPDF, firmDetails: FirmDetails, startY: number): number => {
    let y = startY;

    // Apply Custom Header Text Color
    if (firmDetails.headerTextColor) {
        doc.setTextColor(firmDetails.headerTextColor);
    } else {
        doc.setTextColor(0); // Default Black
    }

    if (firmDetails.logoUrl && !firmDetails.letterheadUrl) {
        try {
            doc.addImage({ imageData: firmDetails.logoUrl, x: MARGIN, y: MARGIN, width: 30, height: 30 });
        } catch (e) {
            console.error("Could not add logo to PDF:", e);
        }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONT_SIZE_LARGE);
    doc.text(firmDetails.name, A4_WIDTH - MARGIN, y, { align: 'right' });
    y += 9; // Increased spacing
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_SIZE_SMALL);
    const addressLines = doc.splitTextToSize(firmDetails.address, 80); // Wrap address
    doc.text(addressLines, A4_WIDTH - MARGIN, y, { align: 'right' });
    y += (addressLines.length * 4); // Adjust Y based on lines

    // Reset color to black for the separator line
    doc.setDrawColor(200);

    y += 10;
    doc.line(MARGIN, y, A4_WIDTH - MARGIN, y);
    y += 15;

    // Reset text color for subsequent content
    doc.setTextColor(0);

    return y;
}


const addFooter = (doc: jsPDF) => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    doc.setFontSize(FONT_SIZE_SMALL);
    doc.setTextColor(100); // Gray footer
    const isVega = typeof window !== 'undefined' && window.sessionStorage.getItem('practicepro_demo_product') === 'vega';
    const productName = isVega ? 'Vega OS' : 'Atrium OS';

    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Page ${i} of ${pageCount}`, A4_WIDTH - MARGIN, A4_HEIGHT - 10, { align: 'right' });
        doc.text(`Generated by ${productName}`, MARGIN, A4_HEIGHT - 10);
    }
    doc.setTextColor(0);
};

const formatDate = (date: string) => new Date(date).toLocaleDateString('en-GB');

// --- INVOICE & RECEIPT GENERATION ---

const populateInvoicePdf = (doc: jsPDF, y: number, invoice: Invoice, client: Contact, firmDetails: FirmDetails) => {
    // 1. BILL TO SECTION (Left) vs INVOICE DETAILS (Right) matching visual layout

    const startY = y;

    // -- Left Column: Billed To --
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100); // Gray text
    doc.text('BILLED TO:', MARGIN, y);

    y += 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0); // Black text
    doc.text(client.name, MARGIN, y);

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50);
    if (client.address) {
        const splitAddress = doc.splitTextToSize(client.address, 80);
        doc.text(splitAddress, MARGIN, y);
    }

    // -- Right Column: Invoice Details --
    // Reset Y to startY for right column
    let rightY = startY;

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('INVOICE', A4_WIDTH - MARGIN, rightY, { align: 'right' });

    rightY += 8;

    const drawDetailRow = (label: string, value: string) => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100);
        const labelWidth = doc.getTextWidth(label);
        doc.text(label, A4_WIDTH - MARGIN - 40, rightY);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);
        doc.text(value, A4_WIDTH - MARGIN, rightY, { align: 'right' });
        rightY += 5;
    };

    drawDetailRow('Invoice #:', invoice.invoiceNumber);
    drawDetailRow('Date:', new Date(invoice.issueDate).toLocaleDateString('en-GB'));
    drawDetailRow('Due Date:', new Date(invoice.dueDate).toLocaleDateString('en-GB'));

    // Move Y down to below the header section (approx 40mm gap)
    y = Math.max(y + 20, rightY + 20);

    // 2. LINE ITEMS TABLE
    const head = [['Description', 'Hours', 'Rate', 'Amount']];
    const body = invoice.lineItems.map(item => [
        item.description,
        item.hours > 0 ? item.hours.toFixed(2) : '-',
        item.rate > 0 ? `N ${formatNaira(item.rate)}` : '-',
        `N ${formatNaira(item.total)}`
    ]);

    const calcSubTotal = invoice.lineItems.reduce((sum, item) => sum + item.total, 0);
    const subTotal = invoice.subTotal !== undefined ? invoice.subTotal : calcSubTotal;
    const taxAmount = invoice.taxAmount !== undefined ? invoice.taxAmount : 0;
    const totalAmount = subTotal + taxAmount;

    autoTable(doc, {
        startY: y,
        head,
        body,
        theme: 'striped',
        // Match the Primary color (Green-600 #16A34A)
        headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold', halign: 'left' },
        bodyStyles: { textColor: 50 },
        columnStyles: {
            0: { cellWidth: 'auto' }, // Description
            1: { halign: 'right', cellWidth: 25 },
            2: { halign: 'right', cellWidth: 35 },
            3: { halign: 'right', cellWidth: 35, fontStyle: 'bold' },
        },
        margin: { left: MARGIN, right: MARGIN },
        didDrawPage: (data) => {
            y = data.cursor?.y ?? y;
        }
    });

    // 3. TOTALS SECTION (Right Aligned)
    y += 5;
    const totalsX = A4_WIDTH - MARGIN - 60; // Start position for labels
    const valuesX = A4_WIDTH - MARGIN;     // End position for values

    const drawTotalRow = (label: string, value: string, isTotal: boolean = false) => {
        y += isTotal ? 2 : 0;
        doc.setFontSize(isTotal ? 12 : 9);
        doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
        doc.setTextColor(isTotal ? 0 : 80);
        doc.text(label, totalsX, y);
        doc.text(value, valuesX, y, { align: 'right' });
        y += isTotal ? 10 : 6;
    };

    drawTotalRow('Subtotal', `N ${formatNaira(subTotal)}`);
    if (taxAmount > 0) {
        drawTotalRow('VAT (7.5%)', `N ${formatNaira(taxAmount)}`);
        // Draw line before total
        doc.setDrawColor(200);
        doc.line(totalsX, y, A4_WIDTH - MARGIN, y);
        y += 4;
    }

    drawTotalRow('Total', `N ${formatNaira(totalAmount)}`, true);


    // 4. PAYMENT DETAILS BOX (Bottom Left/Center)
    // Matches the gray box in UI
    y += 10;

    // Check if we have space, else new page
    if (y > A4_HEIGHT - 60) {
        doc.addPage();
        y = MARGIN;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50);
    doc.text('PAYMENT DETAILS', MARGIN, y);
    y += 3;

    // Draw Transparent Box with Border
    const boxHeight = 25;
    const boxWidth = A4_WIDTH - (MARGIN * 2);

    doc.setDrawColor(200); // Slate-200/Gray border
    doc.roundedRect(MARGIN, y, boxWidth, boxHeight, 2, 2, 'S');

    // Content inside box
    const boxContentY = y + 8;
    const col2X = MARGIN + (boxWidth / 2);

    doc.setFontSize(8);
    doc.setTextColor(100); // Slate-500

    // Row 1
    doc.text('Bank Name', MARGIN + 5, boxContentY);
    doc.text('Account Number', col2X, boxContentY);

    doc.setFontSize(9);
    doc.setTextColor(0); // Black
    doc.setFont('helvetica', 'bold');

    doc.text(invoice.paymentDetails.bankName, MARGIN + 5, boxContentY + 5);
    doc.text(invoice.paymentDetails.accountNumber, col2X, boxContentY + 5);

    // Row 2
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'normal');
    doc.text('Account Name', MARGIN + 5, boxContentY + 12);

    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.paymentDetails.accountName || firmDetails.name, MARGIN + 5, boxContentY + 17);

    // Footer Message
    y += boxHeight + 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150);
    doc.text('Thank you for your business.', A4_WIDTH / 2, y, { align: 'center' });

    addFooter(doc);
    return doc;
};


export const generateInvoicePdf = (invoice: Invoice, firmDetails: FirmDetails, client: Contact) => {
    const { doc, y } = createPdf(firmDetails, ''); // Title is handled inside logic now
    populateInvoicePdf(doc, y > 30 ? y : 30, invoice, client, firmDetails);
    doc.save(`Invoice_${invoice.invoiceNumber}.pdf`);
};

export const getCreditNotePdfDataUrl = (originalInvoice: Invoice, firmDetails: FirmDetails, client: Contact): string => {
    const { doc } = createPdf(firmDetails, `Credit Note for Invoice #${originalInvoice.invoiceNumber}`);
    addFooter(doc);
    return doc.output('datauristring');
};

export const generateReceiptPdf = (invoice: Invoice, firmDetails: FirmDetails, client: Contact, additionalDetails?: { tenancyPeriod?: string }) => {
    const { doc, y: startY } = createPdf(firmDetails, 'Receipt of Payment');
    let y = startY;

    doc.setFont('helvetica', 'bold');
    doc.text('RECEIVED FROM:', MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.text(client.name, MARGIN, y + 5);

    doc.setFontSize(12);
    doc.text(`Payment Date: ${invoice.paidDate ? new Date(invoice.paidDate).toLocaleDateString('en-GB') : 'N/A'}`, A4_WIDTH - MARGIN, y, { align: 'right' });
    doc.text(`Original Invoice: ${invoice.invoiceNumber}`, A4_WIDTH - MARGIN, y + 5, { align: 'right' });
    y += 20;

    const calcSubTotal = invoice.lineItems.reduce((sum, item) => sum + item.total, 0);
    const subTotal = invoice.subTotal !== undefined ? invoice.subTotal : calcSubTotal;
    const taxAmount = invoice.taxAmount !== undefined ? invoice.taxAmount : 0;
    const totalAmount = subTotal + taxAmount;

    doc.setFontSize(10);
    const matterTitle = invoice?.matter?.title || 'General Receipt';
    const isRentReceipt = matterTitle.toLowerCase().includes('rent payment') || !!additionalDetails?.tenancyPeriod;
    const descriptionText = isRentReceipt 
        ? `BEING PAYMENT IN RESPECT OF TENANCY AT:`
        : `BEING PAYMENT FOR PROFESSIONAL SERVICES RENDERED IN RESPECT OF MATTER:`;
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(descriptionText, MARGIN, y);
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(matterTitle.replace('Rent Payment: ', '').toUpperCase(), MARGIN, y + 6);
    y += 18;

    // Add Tenancy Period if available - Highlighting for legal compliance
    if (isRentReceipt && additionalDetails?.tenancyPeriod) {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(MARGIN, y - 5, A4_WIDTH - MARGIN * 2, 12, 1, 1, 'FD');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(`PERIOD OF TENANCY:`, MARGIN + 5, y + 2);
        
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(additionalDetails.tenancyPeriod, MARGIN + 45, y + 2);
        y += 18;
    }

    y += 5;
    doc.setFillColor(241, 245, 249);
    doc.rect(MARGIN, y, A4_WIDTH - MARGIN * 2, 25, 'F');
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text('TOTAL AMOUNT PAID', A4_WIDTH / 2, y + 8, { align: 'center' });
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42); // Premium Slate-900
    doc.text(`${formatNaira(totalAmount)}`, A4_WIDTH / 2, y + 18, { align: 'center' });
    y += 35;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text('This receipt confirms that the payment referenced above has been received in full and credited to the relevant account.', A4_WIDTH / 2, y, { align: 'center', maxWidth: A4_WIDTH - MARGIN * 2 });
    
    // Signature Line
    y += 25;
    const sigLineW = 60;
    const sigX = A4_WIDTH - MARGIN - sigLineW;
    doc.setDrawColor(203, 213, 225);
    doc.line(sigX, y, A4_WIDTH - MARGIN, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(`FOR: ${firmDetails.name.toUpperCase()}`, sigX, y + 5);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Authorised Signatory', sigX, y + 9);

    addFooter(doc);
    doc.save(`Receipt_${invoice.invoiceNumber}.pdf`);
};

export const generateTimesheetReport = (data: TimesheetData, firmDetails: FirmDetails, dateRange: ReportDateRangeOption) => {
    const { doc, y } = createPdf(firmDetails, `Timesheet Report for ${data.user.name}`, getDateRangeString(dateRange));

    const body = data.entries.map(entry => [
        formatDate(entry.date),
        entry.matterTitle,
        entry.description,
        entry.duration.toFixed(2)
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Date', 'Matter', 'Description', 'Hours']],
        body,
        theme: 'striped',
        headStyles: { fillColor: [22, 163, 74] },
        columnStyles: { 3: { halign: 'right' } }
    });

    addFooter(doc);
    doc.save('Timesheet_Report.pdf');
};

export const generateUtilizationReport = (data: UtilizationData, firmDetails: FirmDetails, dateRange: ReportDateRangeOption) => {
    const { doc, y } = createPdf(firmDetails, 'Utilization Report', getDateRangeString(dateRange));

    const body = data.users.map(u => [
        u.user.name,
        u.user.role,
        u.totalHours.toFixed(2),
        u.billableHours.toFixed(2),
        `${u.utilizationRate.toFixed(1)}%`
    ]);

    autoTable(doc, {
        startY: y,
        head: [['User', 'Role', 'Total Hours', 'Billable Hours', 'Utilization Rate']],
        body,
        theme: 'striped',
        headStyles: { fillColor: [22, 163, 74] },
        columnStyles: {
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' }
        }
    });

    addFooter(doc);
    doc.save('Utilization_Report.pdf');
};

export const generateMatterStatusReport = (data: MatterStatusReportData, firmDetails: FirmDetails) => {
    const { doc, y } = createPdf(firmDetails, 'Matter Status Report', getAsOfDateString());

    const body = data.matters.map(m => [
        m.title,
        m.clientName,
        m.status,
        m.currentStage,
        m.assignedTeam
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Matter Title', 'Client', 'Status', 'Current Stage', 'Assigned Team']],
        body,
        theme: 'striped',
        headStyles: { fillColor: [22, 163, 74] },
    });

    addFooter(doc);
    doc.save('Matter_Status_Report.pdf');
};

export const generateProfitLossReport = (data: ProfitLossData, firmDetails: FirmDetails, dateRange: ReportDateRangeOption) => {
    const { doc, y: startY } = createPdf(firmDetails, 'Profit & Loss Statement', getDateRangeString(dateRange));
    let y = startY;

    doc.setFont('helvetica', 'bold');
    doc.text('Revenue', MARGIN, y);
    y += 5;
    autoTable(doc, {
        startY: y,
        body: data.revenue.map(item => [item.description, `N ${formatNaira(item.amount)}`]),
        theme: 'plain',
        columnStyles: { 1: { halign: 'right' } },
        didDrawPage: (hookData) => { y = hookData.cursor?.y ?? y; }
    });
    doc.setFont('helvetica', 'bold');
    doc.text('Total Revenue', MARGIN, y + 5);
    doc.text(`N ${formatNaira(data.totalRevenue)}`, A4_WIDTH - MARGIN, y + 5, { align: 'right' });
    y += 15;

    doc.setFont('helvetica', 'bold');
    doc.text('Expenses', MARGIN, y);
    y += 5;
    autoTable(doc, {
        startY: y,
        body: data.expenses.map(item => [item.description, `N ${formatNaira(item.amount)}`]),
        theme: 'plain',
        columnStyles: { 1: { halign: 'right' } },
        didDrawPage: (hookData) => { y = hookData.cursor?.y ?? y; }
    });
    doc.setFont('helvetica', 'bold');
    doc.text('Total Expenses', MARGIN, y + 5);
    doc.text(`N ${formatNaira(data.totalExpenses)}`, A4_WIDTH - MARGIN, y + 5, { align: 'right' });
    y += 15;

    doc.setDrawColor(0);
    doc.line(MARGIN, y, A4_WIDTH - MARGIN, y);
    y += 5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Net Profit', MARGIN, y);
    doc.text(`N ${formatNaira(data.netProfit)}`, A4_WIDTH - MARGIN, y, { align: 'right' });

    addFooter(doc);
    doc.save('Profit_Loss_Report.pdf');
};

export const generateArAgingReport = (data: ArAgingData, firmDetails: FirmDetails) => {
    const { doc, y: startY } = createPdf(firmDetails, 'Accounts Receivable Aging Report', getAsOfDateString());
    let y = startY;

    doc.setFont('helvetica', 'bold');
    doc.text('Aging Summary', MARGIN, y);
    y += 7;

    const summaryBody = [
        ['Current (0-30 Days)', `N ${formatNaira(data.buckets['0-30'])}`],
        ['31-60 Days', `N ${formatNaira(data.buckets['31-60'])}`],
        ['61-90 Days', `N ${formatNaira(data.buckets['61-90'])}`],
        ['Over 90 Days', `N ${formatNaira(data.buckets['90+'])}`],
    ];

    autoTable(doc, {
        startY: y,
        body: summaryBody,
        theme: 'grid',
        styles: { fontSize: 10 },
        columnStyles: { 1: { halign: 'right' } },
        didDrawPage: (hookData) => {
            y = hookData.cursor?.y ?? y;
        }
    });

    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Total Outstanding', MARGIN, y);
    doc.text(`N ${formatNaira(data.total)}`, A4_WIDTH - MARGIN - 1, y, { align: 'right' });

    y += 15;

    doc.setFont('helvetica', 'bold');
    doc.text('Detailed Outstanding Invoices', MARGIN, y);
    y += 7;

    const tableBody = data.entries.map(entry => [
        entry.clientName,
        entry.invoiceNumber,
        formatDate(entry.dueDate),
        entry.daysOverdue,
        `N ${formatNaira(entry.amount)}`
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Client', 'Invoice #', 'Due Date', 'Days Overdue', 'Amount']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [22, 163, 74] },
        columnStyles: {
            3: { halign: 'center' },
            4: { halign: 'right' }
        },
    });

    addFooter(doc);
    doc.save('AR_Aging_Report.pdf');
};

export const generateRentReviewNoticePdf = (property: Property, owner: Contact, firmDetails: FirmDetails) => {
    const { doc, y: startY } = createPdf(firmDetails, 'Notice of Rent Review');
    let y = startY;

    const tenantName = property.rentalDetails?.tenantName || 'The Tenant';
    const address = property.address;
    const currentRent = property.rentalDetails?.rentAmount || 0;
    const nextReview = property.rentalDetails?.nextRentReview ? new Date(property.rentalDetails.nextRentReview).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBD';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    // Date of notice
    doc.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), MARGIN, y);
    y += 10;

    // Recipient
    doc.setFont('helvetica', 'bold');
    doc.text('TO:', MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.text(tenantName, MARGIN + 10, y);
    y += 5;
    const splitAddress = doc.splitTextToSize(address, 100);
    doc.text(splitAddress, MARGIN + 10, y);
    y += (splitAddress.length * 5) + 10;

    // Salutation
    doc.text(`Dear ${tenantName.split(' ')[0]},`, MARGIN, y);
    y += 10;

    // Subject
    doc.setFont('helvetica', 'bold');
    doc.text(`RE: RENT REVIEW NOTICE - ${address.split(',')[0].toUpperCase()}`, MARGIN, y);
    doc.line(MARGIN, y + 1, MARGIN + doc.getTextWidth(`RE: RENT REVIEW NOTICE - ${address.split(',')[0].toUpperCase()}`), y + 1);
    y += 15;

    // Body
    doc.setFont('helvetica', 'normal');
    const bodyText = `We act as Solicitors and Property Managers to ${owner.name}, the Landlord of the above-referenced property.

Pursuant to the terms of your tenancy agreement and in accordance with current market valuations, we hereby notify you that a rent review is scheduled for ${nextReview}.

The current annual rent is N ${formatNaira(currentRent)}. Based on our recent assessment of similar properties in the vicinity and prevailing economic conditions, the proposed revised rent will be communicated to you following the formal review process.

Please note that this notice serves as a formal invitation for discussions regarding the new rental terms. We look forward to your continued cooperation.

Yours faithfully,`;

    const splitBody = doc.splitTextToSize(bodyText, A4_WIDTH - (MARGIN * 2));
    doc.text(splitBody, MARGIN, y);
    y += (splitBody.length * 5) + 20;

    // Signature
    doc.setFont('helvetica', 'bold');
    doc.text('For: ' + firmDetails.name, MARGIN, y);
    y += 15;
    
    if (firmDetails.digitalStampUrl) {
        try {
            doc.addImage(firmDetails.digitalStampUrl, 'PNG', MARGIN, y - 10, 30, 30);
            y += 25;
        } catch (e) {
            y += 10;
        }
    } else {
        y += 10;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('PRINCIPAL PARTNER', MARGIN, y);

    addFooter(doc);
    doc.save(`Rent_Review_Notice_${address.split(' ')[0]}.pdf`);
};
