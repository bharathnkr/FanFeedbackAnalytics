// Dashboard.js - Main dashboard functionality

// Set Mets colors as global variables
const metsBlue = '#002D72';
const metsOrange = '#FF5910';

document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initialized');
    
    // Initialize charts
    initializeCharts();
    
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
    loadDashboardData();
    loadFeedbackSummary();
});

// Set up event handlers
function setupEventHandlers() {
    // Apply filters button
    const applyFiltersBtn = document.getElementById('apply-filters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', function() {
            loadDashboardData();
            loadFeedbackSummary();
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
    
    // Reset filters button
    const resetFiltersBtn = document.getElementById('reset-filters');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', function() {
            const categoryFilter = document.getElementById('category-filter');
            const dateRangeFilter = document.getElementById('date-range-filter');
            
            if (categoryFilter) categoryFilter.value = 'all';
            if (dateRangeFilter) dateRangeFilter.value = 'last30';
            
            if (customDateRange) {
                customDateRange.style.display = 'none';
            }
            
            sessionStorage.removeItem('dashboard_category_filter');
            sessionStorage.removeItem('dashboard_date_range_filter');
            sessionStorage.removeItem('dashboard_date_from');
            sessionStorage.removeItem('dashboard_date_to');
            
            loadDashboardData();
            loadFeedbackSummary();
        });
    }
}

// Initialize charts
function initializeCharts() {
    // Initialize chart objects as global variables
    window.categoryChart = null;
    window.sentimentChart = null;
    window.dailyFeedbackChart = null;
    window.contactUserChart = null;
    window.resolutionChart = null;
    
    // Mets colors are now defined globally
    
    try {
        // Category chart
        const categoryElement = document.getElementById('category-chart');
        if (categoryElement) {
            const categoryCtx = categoryElement.getContext('2d');
            window.categoryChart = new Chart(categoryCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Feedback Categories',
                        data: [],
                        backgroundColor: 'rgba(255, 69, 0, 0.7)',
                        borderColor: 'rgba(255, 69, 0, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        },
                        x: {
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }
        
        // Sentiment chart
        const sentimentElement = document.getElementById('sentiment-chart');
        if (sentimentElement) {
            const sentimentCtx = sentimentElement.getContext('2d');
            window.sentimentChart = new Chart(sentimentCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Positive', 'Neutral', 'Negative'],
                    datasets: [{
                        label: 'Sentiment Distribution',
                        data: [0, 0, 0],
                        backgroundColor: [
                            'rgba(40, 167, 69, 0.7)',
                            'rgba(255, 193, 7, 0.7)',
                            'rgba(220, 53, 69, 0.7)'
                        ],
                        borderColor: [
                            'rgba(40, 167, 69, 1)',
                            'rgba(255, 193, 7, 1)',
                            'rgba(220, 53, 69, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                                    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
        
        // Daily feedback chart
        const dailyFeedbackElement = document.getElementById('daily-feedback-chart');
        if (dailyFeedbackElement) {
            const dailyFeedbackCtx = dailyFeedbackElement.getContext('2d');
            window.dailyFeedbackChart = new Chart(dailyFeedbackCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Daily Feedback Count',
                        data: [],
                        backgroundColor: 'rgba(255, 69, 0, 0.2)',
                        borderColor: 'rgba(255, 69, 0, 1)',
                        borderWidth: 2,
                        tension: 0.1,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        },
                        x: {
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }
        
        // Contact User chart
        const contactUserElement = document.getElementById('contact-user-chart');
        if (contactUserElement) {
            const contactUserCtx = contactUserElement.getContext('2d');
            window.contactUserChart = new Chart(contactUserCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Yes', 'No'],
                    datasets: [{
                        label: 'Contact User Distribution',
                        data: [0, 0],
                        backgroundColor: [
                            'rgba(0, 45, 114, 0.7)', // Mets Blue
                            'rgba(204, 204, 204, 0.7)' // Light Gray
                        ],
                        borderColor: [
                            'rgba(0, 45, 114, 1)',
                            'rgba(204, 204, 204, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                                    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
        
        // Resolution Status chart
        const resolutionElement = document.getElementById('resolution-chart');
        if (resolutionElement) {
            const resolutionCtx = resolutionElement.getContext('2d');
            window.resolutionChart = new Chart(resolutionCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Not Started', 'In Progress', 'Completed'],
                    datasets: [{
                        label: 'Resolution Status',
                        data: [0, 0, 0],
                        backgroundColor: [
                            'rgba(220, 53, 69, 0.7)', // Red
                            'rgba(255, 193, 7, 0.7)', // Yellow
                            'rgba(40, 167, 69, 0.7)'  // Green
                        ],
                        borderColor: [
                            'rgba(220, 53, 69, 1)',
                            'rgba(255, 193, 7, 1)',
                            'rgba(40, 167, 69, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                                    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error initializing charts:', error);
    }
}

// Load feedback summary data
function loadFeedbackSummary() {
    showLoadingState();
    
    fetch('/get_feedback_summary')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            updateFeedbackSummary(data);
            hideLoadingState();
        })
        .catch(error => {
            console.error('Error loading feedback summary:', error);
            showErrorState(`Error loading feedback summary: ${error.message}`);
            hideLoadingState();
        });
}

// Update feedback summary UI
function updateFeedbackSummary(data) {
    // Update KPIs
    const totalFeedbackElement = document.getElementById('total-feedback-kpi');
    const categoryCountElement = document.getElementById('category-count-kpi');
    
    if (totalFeedbackElement) {
        totalFeedbackElement.textContent = data.total_feedback.toLocaleString();
    }
    
    if (categoryCountElement) {
        categoryCountElement.textContent = data.category_count.toLocaleString();
    }
    
    // Update Contact User KPI
    const contactUserKpi = document.getElementById('contact-user-kpi');
    const contactUserPercentage = document.getElementById('contact-user-percentage');
    
    if (data.contact_user_stats && data.contact_user_stats.Yes && contactUserKpi && contactUserPercentage) {
        contactUserKpi.textContent = data.contact_user_stats.Yes.count.toLocaleString();
        contactUserPercentage.textContent = `${data.contact_user_stats.Yes.percentage}%`;
    }
    
    // Update Resolved KPI (using Completed status)
    const resolvedKpi = document.getElementById('resolved-kpi');
    const resolvedPercentage = document.getElementById('resolved-percentage');
    
    if (data.resolution_stats && data.resolution_stats.Completed && resolvedKpi && resolvedPercentage) {
        resolvedKpi.textContent = data.resolution_stats.Completed.count.toLocaleString();
        resolvedPercentage.textContent = `${data.resolution_stats.Completed.percentage_of_total}% of all feedback`;
    }
    
    // Update Sentiment Distribution KPIs
    if (data.sentiment_distribution) {
        updateSentimentKPIs(data.sentiment_distribution);
    }
    
    // Update Resolution Status KPIs
    if (data.resolution_stats) {
        updateResolutionStatusKPIs(data.resolution_stats);
    }
}

// Update Sentiment Distribution KPIs
function updateSentimentKPIs(sentimentData) {
    const sentiments = ['Positive', 'Neutral', 'Negative'];
    
    sentiments.forEach(sentiment => {
        const kpiElement = document.getElementById(`${sentiment.toLowerCase()}-sentiment-kpi`);
        const percentageElement = document.getElementById(`${sentiment.toLowerCase()}-sentiment-percentage`);
        
        if (kpiElement && percentageElement) {
            if (sentimentData[sentiment]) {
                kpiElement.textContent = sentimentData[sentiment].count.toLocaleString();
                percentageElement.textContent = `${sentimentData[sentiment].percentage}%`;
            } else {
                kpiElement.textContent = '0';
                percentageElement.textContent = '0%';
            }
        }
    });
}

// Update Resolution Status KPIs
function updateResolutionStatusKPIs(resolutionData) {
    const statuses = {
        'Not Started': 'not-started',
        'In Progress': 'in-progress',
        'Completed': 'completed'
    };
    
    for (const [status, elementId] of Object.entries(statuses)) {
        const kpiElement = document.getElementById(`${elementId}-kpi`);
        const percentageElement = document.getElementById(`${elementId}-percentage`);
        
        if (kpiElement && percentageElement) {
            if (resolutionData[status]) {
                kpiElement.textContent = resolutionData[status].count.toLocaleString();
                percentageElement.textContent = `${resolutionData[status].percentage}% of contact required`;
            } else {
                kpiElement.textContent = '0';
                percentageElement.textContent = '0%';
            }
        }
    }
}

// Load categories from API
function loadCategories() {
    fetch('/get_categories')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
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
        if (sessionStorage.getItem('dashboard_category_filter')) {
            categoryFilter.value = sessionStorage.getItem('dashboard_category_filter');
        }
    }
}

// Load dashboard data from API
function loadDashboardData() {
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
    if (categoryFilter) sessionStorage.setItem('dashboard_category_filter', category);
    if (dateRangeFilter) sessionStorage.setItem('dashboard_date_range_filter', dateRange);
    if (dateRange === 'custom') {
        if (dateFromInput) sessionStorage.setItem('dashboard_date_from', startDate);
        if (dateToInput) sessionStorage.setItem('dashboard_date_to', endDate);
    }

    // Build query parameters
    const params = new URLSearchParams({
        category: category,
        date_range: dateRange
    });

    if (dateRange === 'custom' && startDate && endDate) {
        params.append('start_date', startDate);
        params.append('end_date', endDate);
    }

    // Fetch dashboard data
    fetch(`/get_dashboard_data?${params.toString()}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            updateDashboard(data);
            hideLoadingState();
        })
        .catch(error => {
            console.error('Error loading dashboard data:', error);
            showErrorState(`Error loading dashboard data: ${error.message}`);
            hideLoadingState();
        });
}

// Update the charts and KPIs with new data
function updateDashboard(data) {
    // Update KPIs
    const totalFeedbackElement = document.getElementById('total-feedback-kpi');
    const categoryCountElement = document.getElementById('category-count-kpi');
    
    if (totalFeedbackElement) {
        totalFeedbackElement.textContent = data.total_feedback.toLocaleString();
    }
    
    if (categoryCountElement && data.category_count !== undefined) {
        categoryCountElement.textContent = data.category_count.toLocaleString();
    }
    
    // Update Contact User KPI
    if (data.contact_user_stats) {
        const contactUserKpi = document.getElementById('contact-user-kpi');
        const contactUserPercentage = document.getElementById('contact-user-percentage');
        
        if (data.contact_user_stats.Yes && contactUserKpi && contactUserPercentage) {
            contactUserKpi.textContent = data.contact_user_stats.Yes.count.toLocaleString();
            contactUserPercentage.textContent = `${data.contact_user_stats.Yes.percentage}%`;
        }
    }
    
    // Update Resolved KPI (using Completed status)
    if (data.resolution_stats) {
        const resolvedKpi = document.getElementById('resolved-kpi');
        const resolvedPercentage = document.getElementById('resolved-percentage');
        
        if (data.resolution_stats.Completed && resolvedKpi && resolvedPercentage) {
            resolvedKpi.textContent = data.resolution_stats.Completed.count.toLocaleString();
            resolvedPercentage.textContent = `${data.resolution_stats.Completed.percentage_of_total}% of all feedback`;
        }
    }
    
    // Update Sentiment Distribution KPIs
    if (data.sentiment_distribution) {
        updateSentimentKPIs(data.sentiment_distribution);
    }
    
    // Update Resolution Status KPIs
    if (data.resolution_stats) {
        updateResolutionStatusKPIs(data.resolution_stats);
    }
    
    // Update date range display
    updateDateRangeDisplay(data.date_range);

    // Update category distribution chart
    updateCategoryChart(data.category_distribution);

    // Update sentiment distribution chart
    updateSentimentChart(data.sentiment_distribution);
    
    // Update contact user distribution chart
    updateContactUserChart(data.contact_user_stats);
    
    // Update resolution status chart
    updateResolutionChart(data.resolution_stats);

    // Update daily feedback chart
    updateDailyFeedbackChart(data.daily_feedback);
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

// Update category chart
function updateCategoryChart(categoryData) {
    const categoryChartElement = document.getElementById('category-chart');

    if (categoryChartElement && window.categoryChart) {
        // Check if we have data
        if (Object.keys(categoryData).length === 0) {
            document.getElementById('no-category-data').style.display = 'block';
            categoryChartElement.style.display = 'none';
            return;
        }

        document.getElementById('no-category-data').style.display = 'none';
        categoryChartElement.style.display = 'block';

        // Update chart data
        window.categoryChart.data.labels = Object.keys(categoryData);
        window.categoryChart.data.datasets[0].data = Object.values(categoryData);

        // Set Mets colors for the bars
        const metsBluesToOranges = Object.keys(categoryData).map((_, i) => {
            const ratio = i / Object.keys(categoryData).length;
            return ratio < 0.5 ? metsBlue : metsOrange;
        });
        window.categoryChart.data.datasets[0].backgroundColor = metsBluesToOranges;

        window.categoryChart.update();
    }
}

// Update sentiment chart
function updateSentimentChart(sentimentData) {
    const sentimentChartElement = document.getElementById('sentiment-chart');
    const noSentimentDataElement = document.getElementById('no-sentiment-data');

    if (window.sentimentChart && sentimentData) {
        const sentiments = ['Positive', 'Neutral', 'Negative'];
        const sentimentCounts = sentiments.map(sentiment => 
            sentimentData[sentiment] ? sentimentData[sentiment].count : 0
        );

        if (sentimentCounts.some(count => count > 0)) {
            window.sentimentChart.data.labels = sentiments;
            window.sentimentChart.data.datasets[0].data = sentimentCounts;
            window.sentimentChart.update();

            if (noSentimentDataElement) {
                noSentimentDataElement.style.display = 'none';
            }
        } else if (noSentimentDataElement) {
            noSentimentDataElement.style.display = 'flex';
        }
    }
}

// Update contact user chart
function updateContactUserChart(contactUserStats) {
    const contactUserChartElement = document.getElementById('contact-user-chart');
    const noContactUserDataElement = document.getElementById('no-contact-user-data');

    if (window.contactUserChart && contactUserStats) {
        const contactUserCounts = [
            contactUserStats.Yes ? contactUserStats.Yes.count : 0,
            contactUserStats.No ? contactUserStats.No.count : 0
        ];

        if (contactUserCounts.some(count => count > 0)) {
            window.contactUserChart.data.datasets[0].data = contactUserCounts;
            window.contactUserChart.update();

            if (noContactUserDataElement) {
                noContactUserDataElement.style.display = 'none';
            }
        } else if (noContactUserDataElement) {
            noContactUserDataElement.style.display = 'flex';
        }
    }
}

// Update resolution status chart
function updateResolutionChart(resolutionStats) {
    const resolutionChartElement = document.getElementById('resolution-chart');
    const noResolutionDataElement = document.getElementById('no-resolution-data');

    if (window.resolutionChart && resolutionStats) {
        const statuses = ['Not Started', 'In Progress', 'Completed'];
        const statusCounts = statuses.map(status => 
            resolutionStats[status] ? resolutionStats[status].count : 0
        );

        if (statusCounts.some(count => count > 0)) {
            window.resolutionChart.data.datasets[0].data = statusCounts;
            window.resolutionChart.update();

            if (noResolutionDataElement) {
                noResolutionDataElement.style.display = 'none';
            }
        } else if (noResolutionDataElement) {
            noResolutionDataElement.style.display = 'flex';
        }
    }
}

// Update daily feedback chart
function updateDailyFeedbackChart(dailyData) {
    const dailyChartElement = document.getElementById('daily-feedback-chart');

    if (dailyChartElement && window.dailyFeedbackChart) {
        // Check if we have data
        if (!dailyData || dailyData.length === 0) {
            document.getElementById('no-daily-data').style.display = 'block';
            dailyChartElement.style.display = 'none';
            return;
        }

        document.getElementById('no-daily-data').style.display = 'none';
        dailyChartElement.style.display = 'block';

        // Extract dates and counts
        const dates = dailyData.map(item => item.Date);
        const counts = dailyData.map(item => item.Count);

        // Update chart data
        window.dailyFeedbackChart.data.labels = dates;
        window.dailyFeedbackChart.data.datasets[0].data = counts;

        // Set Mets colors
        window.dailyFeedbackChart.data.datasets[0].borderColor = metsBlue; // Mets blue
        window.dailyFeedbackChart.data.datasets[0].backgroundColor = 'rgba(255, 89, 16, 0.2)'; // Mets orange with transparency

        window.dailyFeedbackChart.update();
    }
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
}

// Show error state
function showErrorState(message) {
    const errorElement = document.getElementById('dashboard-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

// Hide error state
function hideErrorState() {
    const errorElement = document.getElementById('dashboard-error');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}
