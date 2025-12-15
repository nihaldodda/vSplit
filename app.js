// import Firestore instance from the HTML export
import { db } from './firebase.js';
import {
  doc, setDoc, getDoc, updateDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

// …the rest of your app.js logic
// replace your functions (addMember, generateAndShowShareLink, toggleItemSelection, etc.)
// to use setDoc / updateDoc with db as shown in previous message



// Application State Management
class BillSplitterApp {
    constructor() {
        this.state = {
            currentView: 'admin',
            bill: null,
            members: [],
            memberSelections: {},
            shareLink: null,
            sessionId: null,
            currentMember: null,
            uploadedFile: null,
            ocrWorker: null,
            ocrTimeout: null
        };
        
        // Enhanced fallback data from provided JSON
        this.fallbackBill = {
            restaurant: "Sample Restaurant",
            date: "2025-09-11",
            billNumber: "BL-2025-001",
            items: [
                {"id": 1, "name": "Pizza Margherita", "price": 299.00, "category": "food"},
                {"id": 2, "name": "Caesar Salad", "price": 199.00, "category": "food"},
                {"id": 3, "name": "Cold Drink", "price": 89.00, "category": "drink"}
            ],
            subtotal: 587.00,
            tax: 59.00,
            tip: 0.00,
            total: 646.00
        };

        // Enhanced OCR configuration from provided settings
        this.ocrConfig = {
            language: 'eng',
            options: {
                tessedit_ocr_engine_mode: 2, // LSTM + Legacy
                tessedit_pageseg_mode: 6, // Single uniform block of text
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ₹.,()-+/',
                preserve_interword_spaces: 1
            }
        };

        // Enhanced price patterns for better extraction
        this.pricePatterns = [
            /₹\s*(\d+(?:\.\d{1,2})?)/g,
            /Rs\.?\s*(\d+(?:\.\d{1,2})?)/gi,
            /INR\s*(\d+(?:\.\d{1,2})?)/gi,
            /(\d+(?:\.\d{1,2})?)(?:\s*₹)/g,
            /(?:^|\s)(\d{2,4}(?:\.\d{1,2})?)(?=\s|$)/g
        ];

        this.init();
    }

    init() {
        console.log('Initializing BillSplitterApp with enhanced OCR...');
        
        try {
            // Ensure loading overlay is hidden on startup
            this.hideLoading();
            
            // Setup drag and drop functionality
            this.setupDragAndDrop();
            
            // Setup file input event listeners
            this.setupFileInputs();
            
            // Check URL parameters for session joining
            this.checkURLParams();
            
            // Initialize with admin view
            this.switchView('admin');
            
            console.log('App initialized successfully with enhanced OCR capabilities');
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showToast('Error initializing app: ' + error.message, 'error');
        }
    }

    setupFileInputs() {
        try {
            const fileInput = document.getElementById('fileInput');
            const cameraInput = document.getElementById('cameraInput');
            
            if (fileInput) {
                fileInput.addEventListener('change', (event) => {
                    console.log('File input changed');
                    const file = event.target.files[0];
                    if (file) {
                        this.handleFile(file);
                    }
                });
            }
            
            if (cameraInput) {
                cameraInput.addEventListener('change', (event) => {
                    console.log('Camera input changed');
                    const file = event.target.files[0];
                    if (file) {
                        this.handleFile(file);
                    }
                });
            }
            
            console.log('File inputs setup complete');
        } catch (error) {
            console.error('Error setting up file inputs:', error);
        }
    }


    async checkURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const view = urlParams.get('view');
        const sessionId = urlParams.get('session');

        console.log('URL params:', { view, sessionId });

        if (view === 'member') {
            if (sessionId) {
            this.state.sessionId = sessionId;

            // try to load session from Firestore
            const ref = doc(db, 'sessions', sessionId);
            const snap = await getDoc(ref);

            if (snap.exists()) {
                const data = snap.data();
                this.state.bill = data.bill;
                this.state.members = data.members;
                this.state.memberSelections = data.memberSelections || {};

                this.switchView('member');
                this.showMemberSessionInfo(sessionId);

                // listen for live updates
                onSnapshot(ref, (docSnap) => {
                const newData = docSnap.data();
                this.state.members = newData.members;
                this.state.memberSelections = newData.memberSelections || {};
                // update your UI
                this.updateUI();
                });
            } else {
                this.showToast('Session not found in Firestore.', 'error');
                this.switchView('admin');
            }
            } else {
            this.showToast('No session ID found in link. Please ask admin for a new link.', 'error');
            this.switchView('admin');
            }
        } else {
            this.switchView('admin');
        }
    }


    showMemberSessionInfo(sessionId) {
        const banner = document.getElementById('memberSessionInfo');
        const sessionIdSpan = document.getElementById('joinSessionId');
        if (banner && sessionIdSpan) {
            sessionIdSpan.textContent = sessionId;
            banner.classList.remove('hidden');
        }
    }

    // Enhanced File Upload Methods with Better Error Handling
    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        if (!uploadArea) {
            console.error('Upload area not found');
            return;
        }

        console.log('Setting up enhanced drag and drop...');

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.add('drag-over'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('drag-over'), false);
        });

        // Handle dropped files
        uploadArea.addEventListener('drop', (e) => {
            console.log('File dropped');
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        }, false);

        // Also make upload area clickable
        uploadArea.addEventListener('click', () => {
            const fileInput = document.getElementById('fileInput');
            if (fileInput) {
                fileInput.click();
            }
        });
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    handleFile(file) {
        console.log('Handling file:', file.name, file.type, file.size);

        try {
            // Clear any previous errors
            this.hideOCRError();
            this.hideOCRProgress();

            // Enhanced file validation
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                this.showToast('Please upload a JPG, PNG, or WebP image file', 'error');
                console.error('Invalid file type:', file.type);
                return;
            }

            // Validate file size (max 15MB for better OCR)
            const maxSize = 15 * 1024 * 1024; // 15MB
            if (file.size > maxSize) {
                this.showToast('File size must be less than 15MB', 'error');
                console.error('File too large:', file.size);
                return;
            }

            console.log('File validation passed');
            this.state.uploadedFile = file;
            this.showImagePreview(file);
            
        } catch (error) {
            console.error('Error handling file:', error);
            this.showToast('Error handling file: ' + error.message, 'error');
        }
    }

    showImagePreview(file) {
        console.log('Showing image preview for:', file.name);
        
        try {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewSection = document.getElementById('imagePreview');
                const previewImage = document.getElementById('previewImage');
                
                if (previewSection && previewImage) {
                    previewImage.src = e.target.result;
                    previewSection.classList.remove('hidden');
                    
                    // Hide upload area
                    const uploadArea = document.getElementById('uploadArea');
                    if (uploadArea) {
                        uploadArea.style.display = 'none';
                    }
                    
                    console.log('Image preview displayed');
                } else {
                    console.error('Preview elements not found');
                }
            };
            
            reader.onerror = (error) => {
                console.error('FileReader error:', error);
                this.showToast('Error reading file', 'error');
            };
            
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error showing preview:', error);
            this.showToast('Error showing preview: ' + error.message, 'error');
        }
    }

    clearPreview() {
        console.log('Clearing preview');
        
        try {
            const previewSection = document.getElementById('imagePreview');
            const previewImage = document.getElementById('previewImage');
            
            if (previewSection) {
                previewSection.classList.add('hidden');
            }
            
            if (previewImage) {
                previewImage.src = '';
            }
            
            // Show upload area again
            const uploadArea = document.getElementById('uploadArea');
            if (uploadArea) {
                uploadArea.style.display = 'block';
            }
            
            // Clear file inputs
            const fileInput = document.getElementById('fileInput');
            const cameraInput = document.getElementById('cameraInput');
            if (fileInput) fileInput.value = '';
            if (cameraInput) cameraInput.value = '';
            
            // Hide any error states
            this.hideOCRError();
            this.hideOCRProgress();
            
            this.state.uploadedFile = null;
            console.log('Preview cleared');
        } catch (error) {
            console.error('Error clearing preview:', error);
        }
    }

    // Enhanced OCR Implementation with Improved Configuration
    async processBillWithOCR() {
        if (!this.state.uploadedFile) {
            this.showToast('No file to process', 'error');
            return;
        }

        console.log('Starting enhanced OCR processing for:', this.state.uploadedFile.name);
        
        try {
            // Hide preview and show progress
            document.getElementById('imagePreview').classList.add('hidden');
            this.showOCRProgress();
            
            // Check if Tesseract is available
            if (typeof Tesseract === 'undefined') {
                console.error('Tesseract not loaded');
                throw new Error('OCR library not available. Please refresh the page.');
            }

            // Initialize Tesseract worker with enhanced configuration
            console.log('Initializing enhanced Tesseract worker...');
            this.updateOCRProgress(5, 'Initializing OCR engine...');
            
            // Create worker with progress tracking
            this.state.ocrWorker = await Tesseract.createWorker(this.ocrConfig.language, 1, {
                logger: (m) => {
                    console.log('OCR Logger:', m);
                    if (m.status === 'recognizing text' && m.progress) {
                        const progress = Math.round(m.progress * 70) + 15; // Scale to 15-85%
                        this.updateOCRProgress(progress, `Processing text... ${Math.round(m.progress * 100)}%`);
                    }
                },
                errorHandler: (error) => {
                    console.error('OCR Worker Error:', error);
                }
            });

            // Enhanced worker options for better bill recognition
            console.log('Configuring OCR parameters for bill processing...');
            this.updateOCRProgress(10, 'Configuring OCR parameters...');
            
            await this.state.ocrWorker.setParameters(this.ocrConfig.options);

            // Set timeout for OCR processing (45 seconds for better results)
            this.ocrTimeout = setTimeout(() => {
                console.error('OCR timeout reached');
                this.cancelOCR();
                this.showOCRError('OCR processing timed out after 45 seconds. The image might be too complex or unclear. Please try a clearer image or use sample data.');
            }, 45000);

            // Process the image with enhanced settings
            console.log('Processing image with enhanced OCR settings...');
            this.updateOCRProgress(15, 'Analyzing image...');
            
            const { data: { text, confidence } } = await this.state.ocrWorker.recognize(this.state.uploadedFile);
            
            // Clear timeout
            if (this.ocrTimeout) {
                clearTimeout(this.ocrTimeout);
                this.ocrTimeout = null;
            }

            console.log('OCR Text extracted with confidence:', confidence, '%');
            console.log('Raw OCR Text:', text);
            
            this.updateOCRProgress(85, 'Processing extracted text...');
            
            // Enhanced parsing with multiple attempts
            const billData = this.enhancedParseOCRText(text, confidence);
            
            if (billData && billData.items && billData.items.length > 0) {
                this.state.bill = billData;
                this.updateOCRProgress(100, 'OCR processing completed successfully!');
                
                setTimeout(() => {
                    this.hideOCRProgress();
                    this.showBillItems();
                    this.showToast(`Bill processed successfully! Extracted ${billData.items.length} items with ${Math.round(confidence)}% confidence.`, 'success');
                }, 1500);
            } else if (confidence < 30) {
                throw new Error(`Low OCR confidence (${Math.round(confidence)}%). The image quality might be poor.`);
            } else {
                throw new Error('No recognizable items found in the bill. The image might not be a bill or receipt.');
            }

        } catch (error) {
            console.error('Enhanced OCR Error:', error);
            
            // Clear timeout
            if (this.ocrTimeout) {
                clearTimeout(this.ocrTimeout);
                this.ocrTimeout = null;
            }
            
            this.hideOCRProgress();
            
            // Enhanced error messages based on error type
            let errorMessage = 'OCR processing failed. ';
            if (error.message.includes('confidence')) {
                errorMessage += 'Try taking a clearer photo with better lighting.';
            } else if (error.message.includes('timeout')) {
                errorMessage += 'Processing took too long. Try a smaller or clearer image.';
            } else if (error.message.includes('items')) {
                errorMessage += 'Could not find menu items. Make sure the image shows a bill or receipt.';
            } else {
                errorMessage += error.message;
            }
            
            this.showOCRError(errorMessage);
        }
        
        // Cleanup worker
        if (this.state.ocrWorker) {
            try {
                await this.state.ocrWorker.terminate();
                this.state.ocrWorker = null;
                console.log('OCR worker terminated');
            } catch (err) {
                console.error('Error terminating OCR worker:', err);
            }
        }
    }

    // Enhanced OCR Text Parsing with Multiple Strategies
    // Enhanced OCR Text Parsing with Quantity & Unit Price Support
// Enhanced OCR Text Parsing with Quantity & Unit Price Detection
    enhancedParseOCRText(text, confidence) {
        console.log('Enhanced parsing of OCR text with confidence:', confidence, '%');

        try {
            const lines = text.split(/\r?\n/).filter(line => line.trim().length > 1);
            console.log('Text lines:', lines);

            const items = [];
            let subtotal = 0, tax = 0, tip = 0, total = 0;
            let itemId = 1;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                const lowerLine = line.toLowerCase();

                if (this.isNonItemLine(lowerLine)) continue;

                const prices = this.extractPricesFromLine(line);
                if (prices.length === 0) continue;

                const totalPrice = this.getMostLikelyItemPrice(prices);
                if (!totalPrice || totalPrice <= 1 || totalPrice > 10000) continue;

                // --- 🔑 Quantity Detection ---
                // Existing quantity detection logic (improve if needed)
                let qty = 1;

                // Match patterns like "Qty 3" or "Quantity 3"
                const qtyWord = line.match(/qty[\s:]*([0-9]+)/i) || line.match(/quantity[\s:]*([0-9]+)/i);
                if (qtyWord) qty = parseInt(qtyWord[1], 10);

                // Match patterns like "x3" or "X2"
                const xQty = line.match(/x\s?([0-9]+)/i);
                if (xQty) qty = parseInt(xQty[1], 10);

                // Match patterns like "3 pcs", "3 nos"
                const pcsMatch = line.match(/([0-9]+)\s*(pcs?|nos?)/i);
                if (pcsMatch) qty = parseInt(pcsMatch[1], 10);

                // Match patterns like "2 50.00" (qty before price)
                const atMatch = line.match(/([0-9]+)\s+[0-9]+\.[0-9]{2}/);
                if (atMatch) qty = parseInt(atMatch[1], 10);

                if (isNaN(qty) || qty < 1) qty = 1;


                const unitPrice = totalPrice / qty;

                // Clean item name (remove qty and price from line)
                let itemName = this.extractItemName(line, totalPrice);
                itemName = itemName.replace(/(?:x|X)\s*\d+/g, '')
                                .replace(/(?:qty|quantity)[:\s]*\d+/gi, '')
                                .replace(/\d+\s*(pcs?|nos?)/gi, '')
                                .replace(/\d+\s*@\s*[₹]?\s*\d+(\.\d+)?/g, '')
                                .trim();

                if (!itemName || itemName.length < 2) continue;

                const category = this.categorizeItem(itemName);

                const newItem = {
                    id: itemId++,
                    name: itemName,
                    qty: qty,
                    unitPrice: parseFloat(unitPrice.toFixed(2)),
                    price: parseFloat(totalPrice.toFixed(2)), // total for qty
                    category: category
                };

                items.push(newItem);
                console.log('Added item:', newItem);

                // Extract totals if present in this line
                this.extractTotalsFromLine(lowerLine, line, (type, value) => {
                    if (type === 'subtotal') subtotal = value;
                    if (type === 'tax') tax = value;
                    if (type === 'tip') tip = value;
                    if (type === 'total') total = value;
                });
            }

            if (items.length < 2) {
                console.log('Fallback item extraction triggered...');
                items.push(...this.fallbackItemExtraction(text));
            }

            if (subtotal === 0 && items.length > 0) {
                subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
            }

            if (total === 0) total = subtotal + tax + tip;

            if (items.length === 0) return this.emergencyFallbackParsing(text);

            const billData = {
                restaurant: this.extractRestaurantName(text) || "Restaurant",
                date: new Date().toISOString().split('T')[0],
                billNumber: this.extractBillNumber(text) || `OCR-${Date.now()}`,
                items,
                subtotal: Math.max(subtotal, 0),
                tax: Math.max(tax, 0),
                tip: Math.max(tip, 0),
                total: Math.max(total, subtotal + tax + tip)
            };

            console.log('✅ Parsed bill data with quantities:', billData);
            return billData;

        } catch (error) {
            console.error('Error in enhanced OCR parsing:', error);
            return this.emergencyFallbackParsing(text);
        }
    }

    isNonItemLine(lowerLine) {
        const skipPatterns = [
            /^(thank you|thanks|welcome|visit again)/,
            /^(cashier|server|table|order)/,
            /^(date|time|bill|receipt|invoice)/,
            /^(address|phone|email|website)/,
            /^(subtotal|sub total|total|grand total)/,
            /^(tax|vat|gst|service|tip)/,
            /^(cash|card|payment|change)/,
            /^[-=*_#]{3,}/,
            /^\d{1,2}:\d{2}/,
            /^\d{1,2}\/\d{1,2}/
        ];
        
        return skipPatterns.some(pattern => pattern.test(lowerLine)) || lowerLine.length < 3;
    }

    extractPricesFromLine(line) {
        const prices = [];
        
        for (const pattern of this.pricePatterns) {
            let match;
            const regex = new RegExp(pattern.source, pattern.flags);
            
            while ((match = regex.exec(line)) !== null) {
                const priceStr = match[1] || match[0];
                const price = parseFloat(priceStr.replace(/[^\d.]/g, ''));
                
                if (!isNaN(price) && price > 0) {
                    prices.push(price);
                }
            }
        }
        
        return [...new Set(prices)]; // Remove duplicates
    }

    getMostLikelyItemPrice(prices) {
        // Return the largest price (most likely to be the item price)
        return prices.length > 0 ? Math.max(...prices) : 0;
    }

    extractItemName(line, price) {
        // Remove price and clean up the remaining text
        let itemName = line
            .replace(/₹\s*[\d.]+/g, '')
            .replace(/Rs\.?\s*[\d.]+/gi, '')
            .replace(/INR\s*[\d.]+/gi, '')
            .replace(/\b[\d.]+\s*₹/g, '')
            .replace(/\b[\d.]+\b/g, '')
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Capitalize first letter of each word
        itemName = itemName.replace(/\b\w/g, char => char.toUpperCase());
        
        return itemName;
    }

    categorizeItem(itemName) {
        const lowerName = itemName.toLowerCase();
        
        // Drink keywords
        const drinkKeywords = ['drink', 'soda', 'coke', 'pepsi', 'sprite', 'juice', 'water', 'coffee', 'tea', 'beer', 'wine', 'cocktail', 'smoothie', 'shake', 'lemonade'];
        if (drinkKeywords.some(keyword => lowerName.includes(keyword))) {
            return 'drink';
        }
        
        // Dessert keywords
        const dessertKeywords = ['dessert', 'cake', 'ice cream', 'pie', 'cookie', 'brownie', 'pudding', 'sundae', 'parfait'];
        if (dessertKeywords.some(keyword => lowerName.includes(keyword))) {
            return 'dessert';
        }
        
        // Default to food
        return 'food';
    }

    extractTotalsFromLine(lowerLine, originalLine, callback) {
        const patterns = [
            { type: 'subtotal', regex: /(?:sub\s*total|subtotal)\s*[:\-]?\s*₹?\s*([\d.]+)/i },
            { type: 'tax', regex: /(?:tax|vat|gst)\s*[:\-]?\s*₹?\s*([\d.]+)/i },
            { type: 'tip', regex: /(?:tip|service)\s*[:\-]?\s*₹?\s*([\d.]+)/i },
            { type: 'total', regex: /(?:total|grand\s*total)\s*[:\-]?\s*₹?\s*([\d.]+)/i }
        ];
        
        for (const pattern of patterns) {
            const match = originalLine.match(pattern.regex);
            if (match) {
                const value = parseFloat(match[1]);
                if (!isNaN(value) && value >= 0) {
                    callback(pattern.type, value);
                    console.log(`Extracted ${pattern.type}:`, value);
                }
            }
        }
    }

    fallbackItemExtraction(text) {
        console.log('Attempting fallback item extraction...');
        const items = [];
        
        // Look for any number patterns that could be prices
        const allNumbers = text.match(/\d+(?:\.\d{1,2})?/g) || [];
        const likelyPrices = allNumbers
            .map(num => parseFloat(num))
            .filter(price => price >= 10 && price <= 2000) // Reasonable price range
            .slice(0, 10); // Limit to prevent too many false positives
        
        console.log('Likely prices found:', likelyPrices);
        
        likelyPrices.forEach((price, index) => {
            items.push({
                id: index + 1,
                name: `Item ${index + 1}`,
                price: price,
                category: 'food'
            });
        });
        
        return items;
    }

    emergencyFallbackParsing(text) {
        console.log('Using emergency fallback parsing...');
        
        // Return a simplified bill with basic items based on detected prices
        const numbers = text.match(/\d+(?:\.\d{1,2})?/g) || [];
        const prices = numbers
            .map(num => parseFloat(num))
            .filter(price => price >= 20 && price <= 1000)
            .slice(0, 5);
        
        if (prices.length === 0) {
            return null; // Complete failure
        }
        
        const items = prices.map((price, index) => ({
            id: index + 1,
            name: `Item ${index + 1}`,
            price: price,
            category: index % 3 === 0 ? 'drink' : 'food'
        }));
        
        const subtotal = items.reduce((sum, item) => sum + item.price, 0);
        
        return {
            restaurant: "Restaurant (OCR)",
            date: new Date().toISOString().split('T')[0],
            billNumber: `OCR-EMERGENCY-${Date.now()}`,
            items: items,
            subtotal: subtotal,
            tax: Math.round(subtotal * 0.1),
            tip: 0,
            total: Math.round(subtotal * 1.1)
        };
    }

    extractRestaurantName(text) {
        // Try to find restaurant name in first few lines
        const lines = text.split('\n').slice(0, 5);
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length > 3 && trimmed.length < 50 && 
                !trimmed.match(/\d/) && !trimmed.toLowerCase().includes('bill')) {
                return trimmed;
            }
        }
        return null;
    }

    extractBillNumber(text) {
        const billPattern = /(?:bill|receipt|invoice)\s*(?:no|number|#)\s*[:\-]?\s*([A-Za-z0-9\-]+)/i;
        const match = text.match(billPattern);
        return match ? match[1] : null;
    }

    async cancelOCR() {
        console.log('Cancelling enhanced OCR...');
        
        try {
            if (this.ocrTimeout) {
                clearTimeout(this.ocrTimeout);
                this.ocrTimeout = null;
            }
            
            if (this.state.ocrWorker) {
                try {
                    await this.state.ocrWorker.terminate();
                    this.state.ocrWorker = null;
                    console.log('OCR worker cancelled');
                } catch (err) {
                    console.error('Error cancelling OCR worker:', err);
                }
            }
            
            this.hideOCRProgress();
            this.showImagePreview(this.state.uploadedFile);
            this.showToast('OCR processing cancelled', 'info');
        } catch (error) {
            console.error('Error cancelling OCR:', error);
        }
    }

    retryOCR() {
        console.log('Retrying enhanced OCR...');
        this.hideOCRError();
        this.processBillWithOCR();
    }

    useFallbackData() {
        console.log('Using fallback data');
        this.state.bill = { ...this.fallbackBill };
        this.hideOCRProgress();
        this.hideOCRError();
        this.showBillItems();
        this.showToast('Using sample bill data. Add members to continue.', 'info');
    }

    // OCR UI Methods
    showOCRProgress() {
        const progressSection = document.getElementById('ocrProgress');
        if (progressSection) {
            progressSection.classList.remove('hidden');
        }
    }

    hideOCRProgress() {
        const progressSection = document.getElementById('ocrProgress');
        if (progressSection) {
            progressSection.classList.add('hidden');
        }
    }

    updateOCRProgress(percentage, status) {
        const progressFill = document.getElementById('ocrProgressFill');
        const progressPercentage = document.getElementById('progressPercentage');
        const progressStatus = document.getElementById('progressStatus');
        
        if (progressFill) {
            progressFill.style.width = `${Math.min(percentage, 100)}%`;
        }
        if (progressPercentage) {
            progressPercentage.textContent = `${Math.round(percentage)}%`;
        }
        if (progressStatus) {
            progressStatus.textContent = status;
        }
    }

    showOCRError(message) {
        const errorSection = document.getElementById('ocrError');
        const errorMessage = document.getElementById('errorMessage');
        
        if (errorSection) {
            errorSection.classList.remove('hidden');
        }
        if (errorMessage) {
            errorMessage.textContent = message;
        }
    }

    hideOCRError() {
        const errorSection = document.getElementById('ocrError');
        if (errorSection) {
            errorSection.classList.add('hidden');
        }
    }

    showBillItems() {
        const billSection = document.getElementById('billItemsSection');
        if (billSection) {
            billSection.classList.remove('hidden');
        }
        
        // Hide upload area after successful processing
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.style.display = 'none';
        }
        
        this.updateAdminView();
    }

    // View Management - FIXED
    switchView(viewName) {
        console.log('Switching to view:', viewName);
        
        try {
            // Hide all views
            const views = document.querySelectorAll('.view');
            views.forEach(view => {
                view.classList.add('hidden');
            });

            // Show selected view
            const targetView = document.getElementById(viewName + 'View');
            if (targetView) {
                targetView.classList.remove('hidden');
            } else {
                console.error(`View ${viewName}View not found`);
                return;
            }
            
            // Update nav buttons
            const navButtons = document.querySelectorAll('.header__nav .btn');
            navButtons.forEach(btn => {
                btn.classList.remove('btn--primary');
                btn.classList.add('btn--outline');
            });
            
            const activeBtn = document.getElementById(viewName + 'Btn');
            if (activeBtn) {
                activeBtn.classList.remove('btn--outline');
                activeBtn.classList.add('btn--primary');
            }

            this.state.currentView = viewName;
            this.updateUI();
        } catch (error) {
            console.error('Error switching view:', error);
        }
    }

    // UI Update Methods
    updateUI() {
    try {
        switch(this.state.currentView) {
            case 'admin':
                this.updateAdminView();
                break;
            case 'member':
                this.updateMemberView();
                break;
            case 'payment':
                this.updatePaymentView();
                break;
            case 'dashboard':
                this.updateDashboardView();
                break;
            case "groupHistory":
      this.updateGroupHistoryView();
      break;
            default:
                console.warn('Unknown view:', this.state.currentView);
        }
    } catch (error) {
        console.error('Error updating UI:', error);
    }
}


    updateAdminView() {
        try {
            if (this.state.bill) {
                this.renderBillItems();
            }
            
            this.renderMembersList();
            
            // Show generate link section if bill is processed and members exist
            if (this.state.bill && this.state.members.length > 0 && !this.state.shareLink) {
                const generateSection = document.getElementById('generateLinkSection');
                if (generateSection) generateSection.classList.remove('hidden');
                
                const shareSection = document.getElementById('shareLinkSection');
                if (shareSection) shareSection.classList.add('hidden');
                
                const paymentSection = document.getElementById('paymentTrackingSection');
                if (paymentSection) paymentSection.classList.remove('hidden');
            } else if (this.state.shareLink) {
                const generateSection = document.getElementById('generateLinkSection');
                if (generateSection) generateSection.classList.add('hidden');
                
                const shareSection = document.getElementById('shareLinkSection');
                if (shareSection) shareSection.classList.remove('hidden');
                
                const paymentSection = document.getElementById('paymentTrackingSection');
                if (paymentSection) paymentSection.classList.remove('hidden');
            } else {
                const generateSection = document.getElementById('generateLinkSection');
                if (generateSection) generateSection.classList.add('hidden');
                
                const shareSection = document.getElementById('shareLinkSection');
                if (shareSection) shareSection.classList.add('hidden');
                
                const paymentSection = document.getElementById('paymentTrackingSection');
                if (paymentSection) paymentSection.classList.add('hidden');
            }
            
            if (this.state.members.length > 0 && this.state.bill) {
                this.renderPaymentTracking();
            }
        } catch (error) {
            console.error('Error updating admin view:', error);
        }
    }

    updateMemberView() {
        try {
            this.populateMemberSelector();
            if (this.state.currentMember && this.state.bill) {
                this.renderItemsForSelection();
                const itemSection = document.getElementById('itemSelectionSection');
                if (itemSection) itemSection.classList.remove('hidden');
            } else {
                const itemSection = document.getElementById('itemSelectionSection');
                if (itemSection) itemSection.classList.add('hidden');
            }
        } catch (error) {
            console.error('Error updating member view:', error);
        }
    }

    updatePaymentView() {
        try {
            if (this.state.currentMember) {
                this.renderPaymentDetails();
            }
        } catch (error) {
            console.error('Error updating payment view:', error);
        }
    }

    updateDashboardView() {
        try {
            this.renderDashboard();
        } catch (error) {
            console.error('Error updating dashboard view:', error);
        }
    }

    // Bill Management
    renderBillItems() {
    const section = document.getElementById('billItemsSection');
    const tbody = document.getElementById('billItemsList');
    const subtotalEl = document.getElementById('subtotalAmount');
    const taxEl = document.getElementById('taxAmount');
    const tipEl = document.getElementById('tipAmount');
    const totalEl = document.getElementById('totalAmount');

    if (!this.state.bill || !this.state.bill.items) {
        console.warn('No bill data to render');
        return;
    }

    // Clear old rows
    tbody.innerHTML = '';

    this.state.bill.items.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name} <span class="text-sm text-secondary">(x${item.qty})</span></td>
            <td><span class="category-tag category-tag--${item.category}">${item.category}</span></td>
            <td>${item.unitPrice ? item.unitPrice.toFixed(2) : (item.price/item.qty).toFixed(2)}</td>
            <td>${item.price.toFixed(2)}</td>
        `;
        tbody.appendChild(row);
    });

    // Update totals
    subtotalEl.textContent = `₹${this.state.bill.subtotal.toFixed(2)}`;
    taxEl.textContent = `₹${this.state.bill.tax.toFixed(2)}`;
    tipEl.textContent = `₹${this.state.bill.tip.toFixed(2)}`;
    totalEl.textContent = `₹${this.state.bill.total.toFixed(2)}`;

    // Show section
    section.classList.remove('hidden');
}


    // Member Management - updated to use UPI ID instead of phone number
    addMember() {
        console.log('Add member function called');
        
        try {
            const nameInput = document.getElementById('memberName');
            const upiInput = document.getElementById('adminUpiId');
            
            if (!nameInput || !upiInput) {
                console.error('Member input elements not found');
                this.showToast('Member input elements not found', 'error');
                return;
            }
            
            const name = nameInput.value.trim();
            const upiId = upiInput.value.trim();

            console.log('Member data:', { name, upiId });

            if (!name || !upiId) {
                this.showToast('Please enter both name and UPI ID', 'error');
                return;
            }

            // Check for duplicate names
            if (this.state.members.some(member => member.name.toLowerCase() === name.toLowerCase())) {
                this.showToast('A member with this name already exists', 'error');
                return;
            }

            const newMember = {
                id: Date.now(),
                name: name,
                upiId: upiId,
                paymentStatus: 'pending'
            };

            console.log('Adding new member:', newMember);

            this.state.members.push(newMember);
            this.state.memberSelections[newMember.id] = [];
            
            // Clear form inputs
            nameInput.value = '';
            upiInput.value = '';
            
            // Update UI
            this.renderMembersList();
            this.updateAdminView();
            this.showToast('Member added successfully!', 'success');
            
            console.log('Current members:', this.state.members);
        } catch (error) {
            console.error('Error adding member:', error);
            this.showToast('Error adding member: ' + error.message, 'error');
        }
    }

    renderMembersList() {
        try {
            const container = document.getElementById('membersList');
            if (!container) {
                console.error('Members list container not found');
                return;
            }
            
            console.log('Rendering members list, count:', this.state.members.length);
            
            container.innerHTML = '';

            if (this.state.members.length === 0) {
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.innerHTML = `
                    <p class="text-secondary">No members added yet. Add members to start splitting the bill.</p>
                `;
                container.appendChild(emptyState);
                return;
            }

            this.state.members.forEach(member => {
                const memberDiv = document.createElement('div');
                memberDiv.className = 'member-item';
                memberDiv.innerHTML = `
                    <div class="member-info">
                        <div class="member-name">${member.name}</div>
                        <div class="member-upi">${member.upiId}</div>
                    </div>
                    <div class="member-actions">
                        <div class="payment-toggle">
                            <span class="text-sm">Paid</span>
                            <div class="toggle-switch ${member.paymentStatus === 'paid' ? 'active' : ''}" 
                                 onclick="app.togglePaymentStatus(${member.id})"></div>
                        </div>
                        <button class="btn btn--outline btn--sm" onclick="app.removeMember(${member.id})">Remove</button>
                    </div>
                `;
                container.appendChild(memberDiv);
            });
        } catch (error) {
            console.error('Error rendering members list:', error);
        }
    }

    async togglePaymentStatus(memberId) {
  const member = this.state.members.find(m => m.id === memberId);
  if (!member) return;

  member.paymentStatus = member.paymentStatus === "paid" ? "pending" : "paid";

  this.updateUI();

  if (this.state.sessionId) {
    await updateDoc(doc(db, "sessions", this.state.sessionId), {
      members: this.state.members,
    });

    // If all members are paid, save group history
    if (this.state.members.every(m => m.paymentStatus === "paid")) {
      await this.saveGroupHistory();
    }
  }
}
    removeMember(memberId) {
        try {
            this.state.members = this.state.members.filter(m => m.id !== memberId);
            delete this.state.memberSelections[memberId];
            this.renderMembersList();
            this.updateAdminView();
            this.showToast('Member removed', 'info');
        } catch (error) {
            console.error('Error removing member:', error);
        }
    }

    async generateAndShowShareLink() {
        console.log('Generating share link and saving to Firestore...');
        try {
            this.state.sessionId = this.generateSessionId();

            // write to Firestore
            await setDoc(doc(db, 'sessions', this.state.sessionId), {
            bill: this.state.bill,
            members: this.state.members,
            memberSelections: this.state.memberSelections,
            createdAt: Date.now()
            });

            const baseUrl = window.location.origin + window.location.pathname;
            const shareUrl = `${baseUrl}?view=member&session=${this.state.sessionId}`;
            this.state.shareLink = shareUrl;

            document.getElementById('shareLink').value = shareUrl;
            document.getElementById('sessionId').textContent = this.state.sessionId;

            document.getElementById('generateLinkSection').classList.add('hidden');
            document.getElementById('shareLinkSection').classList.remove('hidden');

            this.showToast('Session saved and share link generated!', 'success');
        } catch (err) {
            console.error('Error saving session to Firestore:', err);
            this.showToast('Error saving session: ' + err.message, 'error');
        }
    }


    generateSessionId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    copyShareLink() {
        try {
            const shareInput = document.getElementById('shareLink');
            if (!shareInput) return;
            
            shareInput.select();
            shareInput.setSelectionRange(0, 99999);
            
            if (navigator.clipboard) {
                navigator.clipboard.writeText(shareInput.value).then(() => {
                    this.showToast('📋 Share link copied to clipboard!', 'success');
                }).catch(() => {
                    document.execCommand('copy');
                    this.showToast('📋 Share link copied to clipboard!', 'success');
                });
            } else {
                document.execCommand('copy');
                this.showToast('📋 Share link copied to clipboard!', 'success');
            }
        } catch (err) {
            console.error('Copy failed:', err);
            this.showToast('Failed to copy link', 'error');
        }
    }

    // Member Selection Interface
    populateMemberSelector() {
        try {
            const selector = document.getElementById('memberSelector');
            if (!selector) return;
            
            selector.innerHTML = '<option value="">Choose your name...</option>';
            
            this.state.members.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = member.name;
                selector.appendChild(option);
            });
        } catch (error) {
            console.error('Error populating member selector:', error);
        }
    }

    selectMember() {
        const selector = document.getElementById('memberSelector');
        const memberId = parseInt(selector.value);

        if (memberId) {
            this.state.currentMember = this.state.members.find(m => m.id === memberId);
            if (!this.state.memberSelections[memberId]) {
                this.state.memberSelections[memberId] = [];
            }
            // show the item selection section
            const itemSection = document.getElementById('itemSelectionSection');
            if (itemSection) itemSection.classList.remove('hidden');

            this.updateMemberView();
        } else {
            this.state.currentMember = null;
            const itemSection = document.getElementById('itemSelectionSection');
            if (itemSection) itemSection.classList.add('hidden');
        }
    }


    renderItemsForSelection() {
        if (!this.state.bill || !this.state.currentMember) return;

        try {
            const container = document.getElementById('itemsGrid');
            if (!container) return;
            
            container.innerHTML = '';

            this.state.bill.items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'item-card';
                
                const isSelected = this.state.memberSelections[this.state.currentMember.id].includes(item.id);
                if (isSelected) {
                    itemDiv.classList.add('selected');
                }

                const selectedBy = [];
                Object.keys(this.state.memberSelections).forEach(memberId => {
                    if (this.state.memberSelections[memberId].includes(item.id)) {
                        const member = this.state.members.find(m => m.id === parseInt(memberId));
                        if (member) selectedBy.push(member.name);
                    }
                });

                itemDiv.innerHTML = `
                    <div class="item-card__header">
                        <div class="item-name">${item.name} <span class="text-xs">x${item.qty}</span></div>
                        <div class="item-price">₹${item.unitPrice.toFixed(2)} each</div>
                    </div>
                    <div class="category-tag category-tag--${item.category}">${item.category}</div>
                    ${selectedBy.length > 0 ? `
                        <div class="item-selections">
                            ${selectedBy.map(name => `<span class="selection-badge">${name}</span>`).join('')}
                        </div>
                    ` : ''}
                `;


                itemDiv.onclick = () => this.toggleItemSelection(item.id);
                container.appendChild(itemDiv);
            });

            this.updateMemberTotal();
        } catch (error) {
            console.error('Error rendering items for selection:', error);
        }
    }
    showGroupHistory() {
    this.state.currentView = 'groupHistory';
    this.updateUI();
    }

    showMainPage() {
        this.state.currentView = 'dashboard';  // or 'main' or whichever your default main page is
        this.updateUI();
    }

    async toggleItemSelection(itemId) {
    if (!this.state.currentMember) return; // no member selected
    const memberId = this.state.currentMember.id;
    const selections = this.state.memberSelections[memberId] || [];
    const item = this.state.bill.items.find(i => i.id === itemId);

    // Recognize GST/tax items by name and category
    const taxCategories = ['tax', 'gst', 'cgst', 'sgst', 'igst', 'taxes'];
    // Detect if item is tax by checking CATEGORY and NAME
    const isTaxItem = item &&
        taxCategories.some(tc => item.category?.toLowerCase().includes(tc)) ||
        taxCategories.some(tc => item.name.toLowerCase().includes(tc));

    if (selections.includes(itemId)) {
        // Remove from selections
        this.state.memberSelections[memberId] = selections.filter(id => id !== itemId);
    } else {
        // Only do quantity check for NON-tax items
        if (!isTaxItem) {
            const selectionCount = Object.values(this.state.memberSelections)
                .reduce((count, memberSel) => memberSel.includes(itemId) ? count + 1 : count, 0);
            const availableQty = item?.qty || 1;
            if (selectionCount >= availableQty) {
                this.showToast(`Maximum allowed selections (${availableQty}) reached for ${item.name}.`, 'error');
                return;
            }
        }
        // All members allowed to select tax items, only quantity check for others
        this.state.memberSelections[memberId] = [...selections, itemId];
    }

    // Update totals/UI and Firestore
    this.updateMemberTotal();
    this.updateUI();
    if (this.state.sessionId) {
        await updateDoc(doc(db, 'sessions', this.state.sessionId), {
            memberSelections: this.state.memberSelections
        });
    }
}

    updateMemberTotal() {
        if (!this.state.currentMember || !this.state.bill) return;

        try {
            const selections = this.state.memberSelections[this.state.currentMember.id];
            let selectedTotal = 0;

            selections.forEach(itemId => {
                const item = this.state.bill.items.find(i => i.id === itemId);
                if (item) {
                    let shareCount = 0;
                    Object.values(this.state.memberSelections).forEach(memberSelections => {
                        if (memberSelections.includes(itemId)) shareCount++;
                    });
                    selectedTotal += item.price / Math.max(shareCount, 1);
                }
            });

            const proportion = selectedTotal / this.state.bill.subtotal;
            const taxShare = this.state.bill.tax * proportion;
            const tipShare = this.state.bill.tip * proportion;
            const total = selectedTotal + taxShare + tipShare;

            const selectedTotalEl = document.getElementById('selectedItemsTotal');
            const taxShareEl = document.getElementById('taxShare');
            const tipShareEl = document.getElementById('tipShare');
            const memberTotalEl = document.getElementById('memberTotal');

            if (selectedTotalEl) selectedTotalEl.textContent = `₹${selectedTotal.toFixed(2)}`;
            if (taxShareEl) taxShareEl.textContent = `₹${taxShare.toFixed(2)}`;
            if (tipShareEl) tipShareEl.textContent = `₹${tipShare.toFixed(2)}`;
            if (memberTotalEl) memberTotalEl.textContent = `₹${total.toFixed(2)}`;
        } catch (error) {
            console.error('Error updating member total:', error);
        }
    }
    // Show Group History page
async showGroupHistory() {
  this.currentView = "groupHistory";
  this.updateUI();
  await this.loadGroupHistory();
}

// Fetch Group History from Firestore and display
async loadGroupHistory() {
  const listEl = document.getElementById("groupHistoryList");
  listEl.innerHTML = "Loading...";
  try {
    // Assume you have a 'groupHistory' collection storing past sessions
    const querySnapshot = await getDocs(collection(db, "groupHistory"));
    if (querySnapshot.empty) {
      listEl.innerHTML = "<li>No group history found.</li>";
      return;
    }
    listEl.innerHTML = "";
    querySnapshot.forEach(doc => {
      const data = doc.data();
      const li = document.createElement("li");
      li.textContent = `(${data.date}) - ${data.groupName || 'Group'} - Total: ₹${data.total.toFixed(2)}`;
      li.onclick = () => this.showGroupDetails(doc.id);
      listEl.appendChild(li);
    });
  } catch (error) {
    listEl.innerHTML = `<li>Error loading history: ${error.message}</li>`;
  }
}

// Show Group Details from history record
async showGroupDetails(sessionId) {
  try {
    const docSnap = await getDoc(doc(db, "groupHistory", sessionId));
    if (!docSnap.exists()) {
      alert("History entry not found");
      return;
    }
    const data = docSnap.data();
    alert(`Group: ${data.groupName || 'Group'}\nDate: ${data.date}\nTotal: ₹${data.total.toFixed(2)}`);
    // You can expand to render detailed bill breakdown here in UI
  } catch (error) {
    alert(`Error fetching details: ${error.message}`);
  }
}

// Switch back to main page (adjust with your current "home" page method)
showMainPage() {
  this.currentView = "main";
  this.updateUI();
}

    confirmSelection() {
        if (!this.state.currentMember) return;

        try {
            const selections = this.state.memberSelections[this.state.currentMember.id];
            if (selections.length === 0) {
                this.showToast('Please select at least one item', 'error');
                return;
            }

            this.switchView('payment');
        } catch (error) {
            console.error('Error confirming selection:', error);
        }
    }

    // Payment Management with UPI
    renderPaymentDetails() {
        if (!this.state.currentMember || !this.state.bill) return;

        try {
            const member = this.state.members.find(m => m.id === this.state.currentMember.id);
            
            if (member && member.paymentStatus === 'paid') {
                const qrContainer = document.getElementById('qrCodeContainer');
                const paymentComplete = document.getElementById('paymentComplete');
                if (qrContainer) qrContainer.classList.add('hidden');
                if (paymentComplete) paymentComplete.classList.remove('hidden');
                return;
            }

            const qrContainer = document.getElementById('qrCodeContainer');
            const paymentComplete = document.getElementById('paymentComplete');
            if (qrContainer) qrContainer.classList.remove('hidden');
            if (paymentComplete) paymentComplete.classList.add('hidden');

            const selections = this.state.memberSelections[this.state.currentMember.id] || [];
            let selectedTotal = 0;

            selections.forEach(itemId => {
                const item = this.state.bill.items.find(i => i.id === itemId);
                if (item) {
                    let shareCount = 0;
                    Object.values(this.state.memberSelections).forEach(memberSelections => {
                        if (memberSelections.includes(itemId)) shareCount++;
                    });
                    selectedTotal += item.price / Math.max(shareCount, 1);
                }
            });

            const proportion = selectedTotal / this.state.bill.subtotal;
            const total = selectedTotal + (this.state.bill.tax * proportion) + (this.state.bill.tip * proportion);

            const paymentAmount = document.getElementById('paymentAmount');
            if (paymentAmount) paymentAmount.textContent = `₹${total.toFixed(2)}`;

            this.generateUPIQRCode(total);
        } catch (error) {
            console.error('Error rendering payment details:', error);
        }
    }

    generateUPIQRCode(amount) {
        try {
            const canvas = document.getElementById('qrCanvas');
            if (!canvas) return;

            // Find admin (first member with "admin" in name OR fallback to first member)
            const admin = this.state.members.find(m => m.name.toLowerCase().includes("admin")) || this.state.members[0];

            if (!admin || !admin.upiId) {
                console.error('No valid admin UPI ID found');
                this.showToast('Admin UPI ID not available', 'error');
                return;
            }

            const upiId = admin.upiId.trim(); // Remove any extra spaces

            // Construct universal UPI payment string (works with any app)
            const paymentData = `upi://pay?pa=${encodeURIComponent(upiId)}&am=${amount.toFixed(2)}&cu=INR&tn=Bill split payment via vSplit`;

            console.log('Generating UPI QR code for:', paymentData);

            if (typeof QRCode !== 'undefined') {
                QRCode.toCanvas(canvas, paymentData, {
                    width: 200,
                    height: 200,
                    margin: 2,
                    color: { dark: '#000000', light: '#FFFFFF' }
                }, (error) => {
                    if (error) {
                        console.error('QR Code generation failed:', error);
                        this.showToast('Failed to generate QR code', 'error');
                    } else {
                        console.log('UPI QR code generated successfully');
                    }
                });
            } else {
                console.warn('QRCode library not loaded');
                this.showToast('QR code library not available', 'error');
            }

        } catch (error) {
            console.error('Error generating UPI QR code:', error);
        }
    }



    // Payment Tracking
    renderPaymentTracking() {
        try {
            const container = document.getElementById('paymentGrid');
            if (!container) return;
            
            container.innerHTML = '';

            this.state.members.forEach(member => {
                const card = document.createElement('div');
                card.className = `payment-card ${member.paymentStatus}`;
                
                const selections = this.state.memberSelections[member.id] || [];
                let memberTotal = 0;
                
                if (selections.length > 0 && this.state.bill) {
                    selections.forEach(itemId => {
                        const item = this.state.bill.items.find(i => i.id === itemId);
                        if (item) {
                            let shareCount = 0;
                            Object.values(this.state.memberSelections).forEach(memberSelections => {
                                if (memberSelections.includes(itemId)) shareCount++;
                            });
                            memberTotal += item.price / Math.max(shareCount, 1);
                        }
                    });

                    const proportion = memberTotal / this.state.bill.subtotal;
                    memberTotal += (this.state.bill.tax * proportion) + (this.state.bill.tip * proportion);
                }

                card.innerHTML = `
                    <div class="member-info">
                        <div class="member-name">${member.name}</div>
                        <div class="member-upi">${member.upiId}</div>
                    </div>
                    <div class="payment-amount">
                        <strong>₹${memberTotal.toFixed(2)}</strong>
                    </div>
                    <div class="payment-status">
                        <span class="status status--${member.paymentStatus === 'paid' ? 'success' : 'warning'}">
                            ${member.paymentStatus}
                        </span>
                    </div>
                `;
                container.appendChild(card);
            });
        } catch (error) {
            console.error('Error rendering payment tracking:', error);
        }
    }

    // Dashboard
    renderDashboard() {
        try {
            const totalMembers = this.state.members.length;
            const paidMembers = this.state.members.filter(m => m.paymentStatus === 'paid').length;
            const pendingMembers = totalMembers - paidMembers;
            const progress = totalMembers > 0 ? (paidMembers / totalMembers) * 100 : 0;

            const totalEl = document.getElementById('totalMembers');
            const paidEl = document.getElementById('paidMembers');
            const pendingEl = document.getElementById('pendingMembers');
            const progressEl = document.getElementById('progressFill');

            if (totalEl) totalEl.textContent = totalMembers;
            if (paidEl) paidEl.textContent = paidMembers;
            if (pendingEl) pendingEl.textContent = pendingMembers;
            if (progressEl) progressEl.style.width = `${progress}%`;

            const statusList = document.getElementById('memberStatusList');
            if (!statusList) return;
            
            statusList.innerHTML = '';

            if (this.state.members.length === 0) {
                statusList.innerHTML = '<p class="text-secondary">No members added yet.</p>';
                return;
            }

            this.state.members.forEach(member => {
                const item = document.createElement('div');
                item.className = 'member-status-item';
                item.innerHTML = `
                    <span>${member.name}</span>
                    <span class="status status--${member.paymentStatus === 'paid' ? 'success' : 'warning'}">
                        ${member.paymentStatus}
                    </span>
                `;
                statusList.appendChild(item);
            });
        } catch (error) {
            console.error('Error rendering dashboard:', error);
        }
    }

    // Utility Methods
    hideLoading() {
        try {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) overlay.classList.add('hidden');
        } catch (error) {
            console.error('Error hiding loading:', error);
        }
    }

    showToast(message, type = 'info') {
        try {
            const container = document.getElementById('toastContainer');
            if (!container) return;
            
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            
            container.appendChild(toast);
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 4000);
        } catch (error) {
            console.error('Error showing toast:', error);
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing enhanced app...');
    try {
        window.app = new BillSplitterApp();
        console.log('Enhanced app initialized:', window.app);
        
        // Make app methods globally accessible for onclick handlers
        window.switchView = (viewName) => window.app.switchView(viewName);
        window.handleFileUpload = (event) => {
            const file = event.target.files[0];
            if (file) window.app.handleFile(file);
        };
        window.clearPreview = () => window.app.clearPreview();
        window.processBillWithOCR = () => window.app.processBillWithOCR();
        window.cancelOCR = () => window.app.cancelOCR();
        window.retryOCR = () => window.app.retryOCR();
        window.useFallbackData = () => window.app.useFallbackData();
        window.addMember = () => window.app.addMember();
        window.generateAndShowShareLink = () => window.app.generateAndShowShareLink();
        window.copyShareLink = () => window.app.copyShareLink();
        window.selectMember = () => window.app.selectMember();
        window.confirmSelection = () => window.app.confirmSelection();
    } catch (error) {
        console.error('Error initializing enhanced app:', error);
        document.body.innerHTML = '<div style="text-align:center;padding:50px;"><h2>Error loading application</h2><p>' + error.message + '</p></div>';
    }
});
