// Recent Feedback Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    console.log('Recent Feedback page initialized');
    
    // Initialize tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Load categories for dropdown
    loadCategories();
    
    // Set up event handlers
    setupEventHandlers();
    
    // Load initial data
    loadRecentFeedback(1);
});

// Set up event handlers
function setupEventHandlers() {
    // Apply filters button
    const applyFiltersBtn = document.getElementById('apply-filters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', function() {
            loadRecentFeedback(1); // Reset to page 1 when applying filters
        });
    }
    
    // Send Email button
    const sendEmailBtn = document.getElementById('sendEmailBtn');
    if (sendEmailBtn) {
        sendEmailBtn.addEventListener('click', function() {
            // Get form values
            const to = document.getElementById('emailTo').value;
            const subject = document.getElementById('emailSubject').value;
            const body = document.getElementById('emailBody').value;
            
            // Validate form
            if (!to || !subject || !body) {
                alert('Please fill out all fields');
                return;
            }
            
            // Show success message
            alert('Email sent successfully!');
            
            // Close the modal
            const emailModal = bootstrap.Modal.getInstance(document.getElementById('emailDraftModal'));
            emailModal.hide();
        });
    }
    
    // Reset filters button
    const resetFiltersBtn = document.getElementById('reset-filters');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', function() {
            const categoryFilter = document.getElementById('category-filter');
            const dateRangeFilter = document.getElementById('date-range-filter');
            const customDateRange = document.getElementById('custom-date-range');
            
            if (categoryFilter) categoryFilter.value = 'all';
            if (dateRangeFilter) dateRangeFilter.value = 'last30';
            
            if (customDateRange) {
                customDateRange.style.display = 'none';
            }
            
            // Clear stored filter values
            sessionStorage.removeItem('feedback_category_filter');
            sessionStorage.removeItem('feedback_date_range_filter');
            sessionStorage.removeItem('feedback_date_from');
            sessionStorage.removeItem('feedback_date_to');
            
            loadRecentFeedback(1);
        });
    }
    
    // Date range filter
    const dateRangeFilter = document.getElementById('date-range-filter');
    const customDateRange = document.getElementById('custom-date-range');
    const dateFromInput = document.getElementById('date-from');
    const dateToInput = document.getElementById('date-to');
    
    if (dateRangeFilter) {
        dateRangeFilter.addEventListener('change', function() {
            if (customDateRange) {
                customDateRange.style.display = this.value === 'custom' ? 'block' : 'none';
                
                if (this.value === 'custom') {
                    const today = new Date();
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(today.getDate() - 30);
                    
                    if (dateFromInput) {
                        dateFromInput.value = thirtyDaysAgo.toISOString().split('T')[0];
                        dateFromInput.max = today.toISOString().split('T')[0];
                    }
                    if (dateToInput) {
                        dateToInput.value = today.toISOString().split('T')[0];
                        dateToInput.max = today.toISOString().split('T')[0];
                    }
                }
            }
        });
    }
    
    // Setup feedback detail modal
    const feedbackModal = document.getElementById('feedback-detail-modal');
    if (feedbackModal) {
        feedbackModal.addEventListener('show.bs.modal', function(event) {
            const button = event.relatedTarget;
            const feedbackId = button.getAttribute('data-feedback-id');
            loadFeedbackDetail(feedbackId);
        });
    }
}

// Load categories from API
function loadCategories() {
    fetchWithAuth('/get_categories')
        .then(categories => {
            updateCategoryDropdown(categories);
        })
        .catch(error => {
            console.error('Error loading categories:', error);
        });
}

// Update category dropdown with names
function updateCategoryDropdown(categories) {
    const categoryFilter = document.getElementById('category-filter');
    
    if (categoryFilter) {
        // Clear existing options except the first one (All Categories)
        while (categoryFilter.options.length > 1) {
            categoryFilter.remove(1);
        }
        
        // Add categories to dropdown
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });
        
        // Restore selected category from session storage if available
        if (sessionStorage.getItem('feedback_category_filter')) {
            categoryFilter.value = sessionStorage.getItem('feedback_category_filter');
        }
    }
}

// Load recent feedback with pagination
function loadRecentFeedback(page) {
    showLoadingState();
    
    // Get filter values
    const categoryFilter = document.getElementById('category-filter');
    const dateRangeFilter = document.getElementById('date-range-filter');
    const dateFromInput = document.getElementById('date-from');
    const dateToInput = document.getElementById('date-to');
    
    const category = categoryFilter ? categoryFilter.value : 'all';
    const dateRange = dateRangeFilter ? dateRangeFilter.value : 'last30';
    const startDate = dateFromInput ? dateFromInput.value : null;
    const endDate = dateToInput ? dateToInput.value : null;
    
    // Save filter values to session storage
    if (categoryFilter) sessionStorage.setItem('feedback_category_filter', category);
    if (dateRangeFilter) sessionStorage.setItem('feedback_date_range_filter', dateRange);
    if (dateRange === 'custom') {
        if (dateFromInput) sessionStorage.setItem('feedback_date_from', startDate);
        if (dateToInput) sessionStorage.setItem('feedback_date_to', endDate);
    }
    
    // Build query parameters
    const params = new URLSearchParams({
        category: category,
        date_range: dateRange,
        page: page
    });
    
    if (dateRange === 'custom' && startDate && endDate) {
        params.append('start_date', startDate);
        params.append('end_date', endDate);
    }
    
    // Fetch recent feedback data
    fetchWithAuth(`/get_recent_feedback?${params.toString()}`)
        .then(data => {
            updateFeedbackTable(data.feedback);
            updatePagination(data.pagination);
            updateDateRangeDisplay(data.date_range);
            hideLoadingState();
        })
        .catch(error => {
            console.error('Error loading recent feedback:', error);
            showErrorState(`Error loading recent feedback: ${error.message}`);
            hideLoadingState();
        });
}

// Update feedback table with data
function updateFeedbackTable(feedback) {
    const tableBody = document.getElementById('feedback-table-body');
    const noDataMessage = document.getElementById('no-feedback-data');
    
    if (tableBody) {
        // Clear existing rows
        tableBody.innerHTML = '';
        
        // Check if we have data
        if (!feedback || feedback.length === 0) {
            if (noDataMessage) noDataMessage.style.display = 'block';
            return;
        }
        
        if (noDataMessage) noDataMessage.style.display = 'none';
        
        // Add rows for each feedback item
        feedback.forEach(item => {
            const row = document.createElement('tr');
            
            // ID column
            const idCell = document.createElement('td');
            idCell.textContent = item.ID || '-';
            row.appendChild(idCell);
            
            // First Name column
            const firstNameCell = document.createElement('td');
            firstNameCell.textContent = item['First Name'] || '-';
            row.appendChild(firstNameCell);
            
            // Last Name column
            const lastNameCell = document.createElement('td');
            lastNameCell.textContent = item['Last Name'] || '-';
            row.appendChild(lastNameCell);
            
            // Category column
            const categoryCell = document.createElement('td');
            categoryCell.textContent = item['Main Category'] || '-';
            row.appendChild(categoryCell);
            
            // Sub Category column
            const subCategoryCell = document.createElement('td');
            subCategoryCell.textContent = item['Sub Category'] || '-';
            row.appendChild(subCategoryCell);
            
            // Contact User column
            const contactUserCell = document.createElement('td');
            const contactUser = item['Contact User'] || 'No';
            const contactBadge = document.createElement('span');
            contactBadge.className = 'badge ';
            
            // Apply different colors based on contact requirement
            if (contactUser === 'Yes') {
                contactBadge.className += 'bg-primary';
            } else {
                contactBadge.className += 'bg-secondary';
            }
            
            contactBadge.textContent = contactUser;
            contactUserCell.appendChild(contactBadge);
            row.appendChild(contactUserCell);
            
            // Status column - only meaningful when Contact User is Yes
            const statusCell = document.createElement('td');
            if (contactUser === 'Yes') {
                const status = item['Status'] || 'Not Started';
                const statusBadge = document.createElement('span');
                statusBadge.className = 'badge ';
                
                // Apply different colors based on status
                if (status === 'Completed') {
                    statusBadge.className += 'bg-success';
                } else if (status === 'In Progress') {
                    statusBadge.className += 'bg-warning text-dark';
                } else if (status === 'Not Started') {
                    statusBadge.className += 'bg-danger';
                } else {
                    statusBadge.className += 'bg-secondary';
                }
                
                statusBadge.textContent = status;
                statusCell.appendChild(statusBadge);
            } else {
                statusCell.textContent = '-';
            }
            row.appendChild(statusCell);
            
            // Sentiment column - we're using a placeholder sentiment based on feedback length
            const sentimentCell = document.createElement('td');
            let sentiment = 'Neutral';
            if (item.Feedback) {
                sentiment = item.Feedback.length > 100 ? 'Positive' : (item.Feedback.length < 50 ? 'Negative' : 'Neutral');
            }
            sentimentCell.innerHTML = getSentimentBadge(sentiment);
            row.appendChild(sentimentCell);
            
            // Feedback column
            const feedbackCell = document.createElement('td');
            feedbackCell.className = 'feedback-text';
            feedbackCell.textContent = item.Feedback || '-';
            row.appendChild(feedbackCell);
            
            // Actions column
            const actionsCell = document.createElement('td');
            actionsCell.className = 'text-center'; // Add text-center class for alignment
            
            // Email button - only show if Contact User is Yes and Email exists
            if (contactUser === 'Yes' && item['Email']) {
                const emailBtn = document.createElement('button');
                emailBtn.className = 'btn btn-sm btn-outline-primary me-1';
                emailBtn.innerHTML = '<i class="fas fa-envelope"></i>';
                emailBtn.title = 'Contact Fan';
                emailBtn.setAttribute('data-email', item['Email']);
                emailBtn.setAttribute('data-feedback-id', item['ID']);
                emailBtn.setAttribute('data-fan-name', `${item['First Name'] || ''} ${item['Last Name'] || ''}`.trim());
                emailBtn.addEventListener('click', function() {
                    openEmailModal(this.getAttribute('data-email'), this.getAttribute('data-feedback-id'), this.getAttribute('data-fan-name'));
                });
                actionsCell.appendChild(emailBtn);
            }
            
            // Add details page link with eye icon
            const detailsLink = document.createElement('a');
            detailsLink.href = `/feedback_details/${item.ID}`;
            detailsLink.className = 'btn btn-sm btn-outline-primary me-1';
            detailsLink.innerHTML = '<i class="fas fa-eye"></i>';
            detailsLink.setAttribute('title', 'View Details');
            actionsCell.appendChild(detailsLink);
            
            // Add edit button with edit icon
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-sm btn-outline-success';
            editBtn.innerHTML = '<i class="fas fa-edit"></i>';
            editBtn.setAttribute('title', 'Edit Feedback');
            editBtn.setAttribute('data-feedback-id', item.ID);
            editBtn.addEventListener('click', function() {
                // Redirect to edit page with correct URL format (hyphen, not underscore)
                window.location.href = `/edit-feedback/${this.getAttribute('data-feedback-id')}`;
            });
            actionsCell.appendChild(editBtn);
            
            row.appendChild(actionsCell);
            
            tableBody.appendChild(row);
        });
    }
}

// Update pagination controls
function updatePagination(pagination) {
    const paginationElement = document.getElementById('feedback-pagination');
    const paginationInfoElement = document.getElementById('pagination-info');
    
    // Update pagination info text
    if (paginationInfoElement && pagination) {
        const startRecord = ((pagination.page - 1) * pagination.page_size) + 1;
        const endRecord = Math.min(pagination.page * pagination.page_size, pagination.total_records);
        paginationInfoElement.textContent = `Showing ${startRecord} to ${endRecord} of ${pagination.total_records} entries`;
    }
    
    if (paginationElement && pagination) {
        // Clear existing pagination
        paginationElement.innerHTML = '';
        
        // Don't show pagination if there's only one page
        if (pagination.total_pages <= 1) {
            return;
        }
        
        // Create pagination list
        const ul = document.createElement('ul');
        ul.className = 'pagination justify-content-center';
        
        // Previous button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${pagination.current_page === 1 ? 'disabled' : ''}`;
        const prevLink = document.createElement('a');
        prevLink.className = 'page-link';
        prevLink.href = '#';
        prevLink.innerHTML = '&laquo;';
        prevLink.setAttribute('aria-label', 'Previous');
        if (pagination.current_page > 1) {
            prevLink.addEventListener('click', function(e) {
                e.preventDefault();
                loadRecentFeedback(pagination.current_page - 1);
            });
        }
        prevLi.appendChild(prevLink);
        ul.appendChild(prevLi);
        
        // Page numbers
        const maxPages = 5;
        let startPage = Math.max(1, pagination.current_page - Math.floor(maxPages / 2));
        let endPage = Math.min(pagination.total_pages, startPage + maxPages - 1);
        
        if (endPage - startPage + 1 < maxPages) {
            startPage = Math.max(1, endPage - maxPages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageLi = document.createElement('li');
            pageLi.className = `page-item ${i === pagination.current_page ? 'active' : ''}`;
            const pageLink = document.createElement('a');
            pageLink.className = 'page-link';
            pageLink.href = '#';
            pageLink.textContent = i;
            if (i !== pagination.current_page) {
                pageLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    loadRecentFeedback(i);
                });
            }
            pageLi.appendChild(pageLink);
            ul.appendChild(pageLi);
        }
        
        // Next button
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${pagination.current_page === pagination.total_pages ? 'disabled' : ''}`;
        const nextLink = document.createElement('a');
        nextLink.className = 'page-link';
        nextLink.href = '#';
        nextLink.innerHTML = '&raquo;';
        nextLink.setAttribute('aria-label', 'Next');
        if (pagination.current_page < pagination.total_pages) {
            nextLink.addEventListener('click', function(e) {
                e.preventDefault();
                loadRecentFeedback(pagination.current_page + 1);
            });
        }
        nextLi.appendChild(nextLink);
        ul.appendChild(nextLi);
        
        // Add pagination to container
        paginationElement.appendChild(ul);
    }
}

// Update date range display
function updateDateRangeDisplay(dateRange) {
    const dateRangeText = document.getElementById('date-range-text');
    const lastRefreshTime = document.getElementById('last-refresh-time');
    
    if (dateRangeText && dateRange) {
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        
        dateRangeText.textContent = `${formatDate(startDate)} to ${formatDate(endDate)}`;
    }
    
    if (lastRefreshTime) {
        lastRefreshTime.textContent = formatDate(new Date());
    }
}

// Load feedback detail for modal
function loadFeedbackDetail(feedbackId) {
    const modalTitle = document.getElementById('feedbackDetailsModalLabel');
    const modalContent = document.getElementById('feedback-details-content');
    const modalLoading = document.getElementById('feedback-details-loading');
    
    if (modalTitle) {
        modalTitle.textContent = `Fan Feedback #${feedbackId}`;
    }
    
    if (modalContent && modalLoading) {
        // Show loading state
        modalContent.style.display = 'none';
        modalLoading.style.display = 'block';
        
        // Fetch feedback details
        fetch(`/get_feedback_details/${feedbackId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                
                // Populate modal with feedback details
                populateFeedbackModal(data);
                
                // Hide loading state
                modalLoading.style.display = 'none';
                modalContent.style.display = 'block';
            })
            .catch(error => {
                console.error('Error loading feedback details:', error);
                
                // Show error message
                modalLoading.style.display = 'none';
                modalContent.style.display = 'block';
                modalContent.innerHTML = `<div class="alert alert-danger">Error loading feedback details: ${error.message}</div>`;
            });
    }
}

// Populate feedback detail modal
function populateFeedbackModal(feedback) {
    const modalTitle = document.getElementById('feedbackDetailsModalLabel');
    const modalContent = document.getElementById('feedback-details-content');
    
    if (modalTitle && modalContent) {
        // Set modal title
        modalTitle.textContent = `Fan Feedback #${feedback.ID || ''}`;
        
        // Clear existing content
        modalContent.innerHTML = '';
        
        // Create feedback details
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'feedback-details';
        
        // Add metadata section
        const metadataDiv = document.createElement('div');
        metadataDiv.className = 'metadata mb-4';
        
        // Add fan name
        if (feedback['First Name'] || feedback['Last Name']) {
            const nameDiv = document.createElement('div');
            nameDiv.className = 'mb-2';
            nameDiv.innerHTML = `<strong>Fan:</strong> ${feedback['First Name'] || ''} ${feedback['Last Name'] || ''}`;
            metadataDiv.appendChild(nameDiv);
        }
        
        // Add age (calculated from Date of Birth)
        if (feedback['Date of Birth']) {
            const dateDiv = document.createElement('div');
            dateDiv.className = 'mb-2';
            const birthDate = new Date(feedback['Date of Birth']);
            const age = calculateAge(birthDate);
            dateDiv.innerHTML = `<strong>Age:</strong> ${age} years`;
            metadataDiv.appendChild(dateDiv);
        }
        
        // Add date submitted button
        const dateSubmittedDiv = document.createElement('div');
        dateSubmittedDiv.className = 'mb-2';
        const dateSubmitted = feedback['Date Submitted'] || feedback['Date of Birth'] || new Date().toISOString();
        const formattedDate = formatDate(new Date(dateSubmitted));
        
        const dateButton = document.createElement('button');
        dateButton.className = 'btn btn-sm btn-outline-secondary';
        dateButton.innerHTML = `<i class="far fa-calendar-alt me-1"></i> Date Submitted: ${formattedDate}`;
        dateSubmittedDiv.appendChild(dateButton);
        metadataDiv.appendChild(dateSubmittedDiv);
        
        // Add category
        if (feedback['Main Category']) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'mb-2';
            categoryDiv.innerHTML = `<strong>Main Category:</strong> ${feedback['Main Category']}`;
            metadataDiv.appendChild(categoryDiv);
        }
        
        // Add sub-category
        if (feedback['Sub Category']) {
            const subCategoryDiv = document.createElement('div');
            subCategoryDiv.className = 'mb-2';
            subCategoryDiv.innerHTML = `<strong>Sub Category:</strong> ${feedback['Sub Category']}`;
            metadataDiv.appendChild(subCategoryDiv);
        }
        
        // Add sentiment - using placeholder based on feedback length
        let sentiment = 'Neutral';
        if (feedback.Feedback) {
            sentiment = feedback.Feedback.length > 100 ? 'Positive' : (feedback.Feedback.length < 50 ? 'Negative' : 'Neutral');
        }
        const sentimentDiv = document.createElement('div');
        sentimentDiv.className = 'mb-2';
        sentimentDiv.innerHTML = `<strong>Sentiment:</strong> ${getSentimentBadge(sentiment)}`;
        metadataDiv.appendChild(sentimentDiv);
        
        detailsDiv.appendChild(metadataDiv);
        
        // Add feedback content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        
        const contentTitle = document.createElement('h5');
        contentTitle.textContent = 'Feedback Content';
        contentDiv.appendChild(contentTitle);
        
        const contentText = document.createElement('div');
        contentText.className = 'p-3 bg-light rounded';
        contentText.textContent = feedback.Feedback || 'No feedback content available.';
        contentDiv.appendChild(contentText);
        
        detailsDiv.appendChild(contentDiv);
        
        // Add contact information
        const contactDiv = document.createElement('div');
        contactDiv.className = 'contact-info mt-4';
        
        const contactTitle = document.createElement('h5');
        contactTitle.textContent = 'Contact Information';
        contactDiv.appendChild(contactTitle);
        
        const contactList = document.createElement('ul');
        contactList.className = 'list-group';
        
        // Add email
        if (feedback['Email']) {
            const emailItem = document.createElement('li');
            emailItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            
            const keySpan = document.createElement('span');
            keySpan.className = 'fw-bold';
            keySpan.textContent = 'Email';
            emailItem.appendChild(keySpan);
            
            const valueSpan = document.createElement('span');
            valueSpan.textContent = feedback['Email'] || '-';
            emailItem.appendChild(valueSpan);
            
            contactList.appendChild(emailItem);
        }
        
        // Add phone
        if (feedback['Phone Number']) {
            const phoneItem = document.createElement('li');
            phoneItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            
            const keySpan = document.createElement('span');
            keySpan.className = 'fw-bold';
            keySpan.textContent = 'Phone';
            phoneItem.appendChild(keySpan);
            
            const valueSpan = document.createElement('span');
            valueSpan.textContent = feedback['Phone Number'] || '-';
            phoneItem.appendChild(valueSpan);
            
            contactList.appendChild(phoneItem);
        }
        
        contactDiv.appendChild(contactList);
        detailsDiv.appendChild(contactDiv);
        
        modalContent.appendChild(detailsDiv);
    }
}

// Format key for display
function formatKey(key) {
    // Convert camelCase or snake_case to Title Case with spaces
    return key
        .replace(/([A-Z])/g, ' $1') // Insert space before capital letters
        .replace(/_/g, ' ') // Replace underscores with spaces
        .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
        .trim();
}

// Get sentiment badge HTML
function getSentimentBadge(sentiment) {
    let badgeClass = 'bg-secondary';
    let icon = 'fa-meh';
    
    if (sentiment === 'Positive') {
        badgeClass = 'bg-success'; // Green for positive
        icon = 'fa-smile';
    } else if (sentiment === 'Negative') {
        badgeClass = 'bg-danger'; // Red for negative
        icon = 'fa-frown';
    } else if (sentiment === 'Neutral') {
        badgeClass = 'bg-warning text-dark';
        icon = 'fa-meh';
    }
    
    return `<span class="badge ${badgeClass}"><i class="far ${icon} me-1"></i>${sentiment}</span>`;

}

// Format date for display
function formatDate(date) {
    if (!date) return '';
    
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Calculate age from date of birth
function calculateAge(birthDate) {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Adjust age if birthday hasn't occurred yet this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
}

// Open email modal with pre-filled information
function openEmailModal(email, feedbackId, fanName) {
    // Get the modal elements
    const emailModal = new bootstrap.Modal(document.getElementById('emailDraftModal'));
    const emailToInput = document.getElementById('emailTo');
    const emailSubjectInput = document.getElementById('emailSubject');
    const emailBodyInput = document.getElementById('emailBody');
    const emailLoading = document.getElementById('emailLoading');
    const generateButton = document.getElementById('generateEmailBtn');
    const sendEmailBtn = document.getElementById('sendEmailBtn');
    
    // Generate a unique tracking ID for this email
    const trackingId = generateEmailTrackingId(feedbackId);
    
    // Store the tracking ID in a hidden field
    document.getElementById('emailTrackingId').value = trackingId;
    
    // Pre-fill the form fields
    emailToInput.value = email;
    emailSubjectInput.value = `Fan Feedback Follow-up #${feedbackId} [Ref:${trackingId}]`;
    
    // Show a loading placeholder in the email body
    emailBodyInput.value = 'Generating personalized response...';
    
    // Show the modal
    emailModal.show();
    
    // Set up the generate button click handler for regenerating content
    if (generateButton) {
        generateButton.onclick = function() {
            generateEmailWithLLM(feedbackId, fanName, emailBodyInput, emailLoading, generateButton, trackingId);
        };
    }
    
    // Set up send email button to launch Outlook
    if (sendEmailBtn) {
        sendEmailBtn.onclick = function() {
            // Record the email tracking ID in the database before sending
            recordEmailTracking(feedbackId, trackingId).then(() => {
                sendEmailViaOutlook(emailToInput.value, emailSubjectInput.value, emailBodyInput.value);
            }).catch(error => {
                console.error('Error recording email tracking:', error);
                // Still send the email even if tracking fails
                sendEmailViaOutlook(emailToInput.value, emailSubjectInput.value, emailBodyInput.value);
            });
        };
    }
    
    // Automatically generate AI content when modal opens
    setTimeout(() => {
        generateEmailWithLLM(feedbackId, fanName, emailBodyInput, emailLoading, generateButton, trackingId);
    }, 300); // Small delay to ensure modal is fully displayed
}

// Generate email content using Straive LLM
async function generateEmailWithLLM(feedbackId, fanName, emailBodyInput, emailLoadingElement, generateButton, trackingId) {
    // Show loading state
    if (emailLoadingElement) emailLoadingElement.style.display = 'block';
    if (generateButton) generateButton.disabled = true;
    
    try {
        // First, get the feedback details
        const feedbackResponse = await fetch(`/get_feedback_details/${feedbackId}`);
        const feedbackData = await feedbackResponse.json();
        
        if (!feedbackResponse.ok) {
            throw new Error('Failed to fetch feedback details');
        }
        
        // Prepare the prompt for the LLM - keep it concise
        const prompt = {
            contents: [{
                parts: [{
                    text: `Write a brief, professional email response to this fan feedback:
                    
                    Name: ${fanName}
                    Category: ${feedbackData['Main Category'] || 'N/A'}
                    Sub Category: ${feedbackData['Sub Category'] || 'N/A'}
                    Status: ${feedbackData['Status'] || 'Pending'}
                    Sentiment: ${feedbackData['Sentiment'] || 'Neutral'}
                    Feedback: ${feedbackData['Feedback'] || 'No feedback text available.'}
                    
                    Keep it under 150 words with greeting, short body, and sign-off. Be direct and solution-focused.`
                }]
            }]
        };
        
        // Call the Straive LLM API
        const llmResponse = await fetch('https://llmfoundry.straive.com/gemini/v1beta/models/gemini-2.0-flash:generateContent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImJoYXJhdGhrdW1hci5yZWRkeUBzdHJhaXZlLmNvbSJ9.i17KBRGPox17bkpxAjrfBJNoa6x7E0wrC_NprQeli4Y`
            },
            body: JSON.stringify(prompt)
        });
        
        const llmData = await llmResponse.json();
        
        if (!llmResponse.ok || !llmData.candidates || !llmData.candidates[0].content.parts[0].text) {
            throw new Error('Failed to generate email content');
        }
        
        // Update the email body with the generated content
        emailBodyInput.value = llmData.candidates[0].content.parts[0].text;
        
        // Show success notification
        showNotification('Email content generated successfully!', 'success');
        
    } catch (error) {
        console.error('Error generating email content:', error);
        showNotification('Failed to generate email content. Please try again.', 'error');
    } finally {
        // Hide loading state
        if (emailLoadingElement) emailLoadingElement.style.display = 'none';
        if (generateButton) generateButton.disabled = false;
    }
}

// Generate a unique tracking ID for email correspondence
function generateEmailTrackingId(feedbackId) {
    // Create a tracking ID that includes the feedback ID, timestamp, and random digits
    const timestamp = Date.now();
    const randomDigits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `FFA-${feedbackId}-${timestamp}-${randomDigits}`;
}

// Record the email tracking ID in the database
async function recordEmailTracking(feedbackId, trackingId) {
    try {
        const response = await fetch('/record_email_tracking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                feedback_id: feedbackId,
                tracking_id: trackingId,
                sent_time: new Date().toISOString()
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Failed to record email tracking');
        }
        
        return result;
    } catch (error) {
        console.error('Error recording email tracking:', error);
        throw error;
    }
}

// Send email via Outlook using mailto protocol
function sendEmailViaOutlook(to, subject, body) {
    // Get the tracking ID from the hidden field
    const trackingId = document.getElementById('emailTrackingId').value;
    
    // Append the tracking ID to the email body in a subtle footer
    const bodyWithTracking = body + 
        '\n\n---\n' +
        `Ref: ${trackingId} - Please keep this reference in your reply for our tracking system.`;
    
    // Create the mailto URL with all parameters
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyWithTracking)}`;
    
    try {
        // Open the default email client (Outlook)
        window.location.href = mailtoUrl;
        
        // Close the modal after a short delay
        setTimeout(() => {
            const emailModal = bootstrap.Modal.getInstance(document.getElementById('emailDraftModal'));
            if (emailModal) {
                emailModal.hide();
            }
            // Show success notification
            showNotification('Email launched in Outlook', 'success');
        }, 500);
    } catch (error) {
        console.error('Error launching email client:', error);
        showNotification('Error launching email client. Please try again.', 'error');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show notification-popup`;
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Add styles if they don't exist
    if (!document.getElementById('notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification-popup {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1050;
                min-width: 300px;
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            }
        `;
        document.head.appendChild(styles);
    }
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Show loading state
function showLoadingState() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

// Hide loading state
function hideLoadingState() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
    
    // Also hide the feedback loading spinner
    const feedbackLoading = document.getElementById('feedback-loading');
    if (feedbackLoading) {
        feedbackLoading.style.display = 'none';
    }
}

// Show error state
function showErrorState(message) {
    const errorElement = document.getElementById('feedback-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

// Hide error state
function hideErrorState() {
    const errorElement = document.getElementById('feedback-error');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}
