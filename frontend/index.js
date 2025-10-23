import {initializeBlock, useBase, useRecords, useCustomProperties, useColorScheme} from '@airtable/blocks/interface/ui';
import {FieldType} from '@airtable/blocks/interface/models';
import React, {useCallback, useMemo, useState} from 'react';
import './style.css';

function EnquiryDashboard() {
    const base = useBase();
    const table = base.tables[0];
    const records = useRecords(table);
    const {colorScheme} = useColorScheme();

    // Custom properties configuration
    const customPropertiesConfig = useCallback((base) => {
        const table = base.tables[0];
        const dateFields = table.fields.filter(field => 
            field.type === FieldType.DATE || field.type === FieldType.DATE_TIME
        );
        
        return [
            {
                key: 'dateField',
                label: 'Date Field',
                type: 'field',
                table: table,
                possibleValues: dateFields.length > 0 ? dateFields : undefined, // Show all fields if no date fields exist
                defaultValue: dateFields.find(field => 
                    field.name.toLowerCase().includes('date created') || 
                    field.name.toLowerCase().includes('created')
                )
            }
        ];
    }, []);

    const {customPropertyValueByKey, errorState} = useCustomProperties(customPropertiesConfig);
    const [showAssistant, setShowAssistant] = useState(false);
    const [assistantMessages, setAssistantMessages] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState('');

    // Enhanced Smart Assistant
    const getSmartResponse = (question, metrics, records, table) => {
        const lowerQuestion = question.toLowerCase();
        
        // Helper function to get date from record
        const getRecordDate = (record) => {
            const dateCreatedField = table.fields.find(field => 
                (field.type === FieldType.DATE || field.type === FieldType.DATE_TIME) && 
                (field.name.toLowerCase().includes('date created') || 
                 field.name.toLowerCase().includes('created date'))
            );
            const createdField = table.fields.find(field => 
                (field.type === FieldType.DATE || field.type === FieldType.DATE_TIME) && 
                field.name.toLowerCase().includes('created')
            );
            
            if (dateCreatedField && record.getCellValue(dateCreatedField)) {
                return record.getCellValue(dateCreatedField);
            } else if (createdField && record.getCellValue(createdField)) {
                return record.getCellValue(createdField);
            }
            return null;
        };
        
        // Helper function to get field value
        const getFieldValue = (record, fieldName) => {
            const field = table.fields.find(f => f.name.toLowerCase().includes(fieldName.toLowerCase()));
            if (field) {
                const value = record.getCellValue(field);
                if (value === null || value === undefined) return 'Not set';
                if (typeof value === 'object' && value.name) return value.name;
                return String(value);
            }
            return 'Field not found';
        };
        
        // Helper function to analyze trends
        const analyzeTrends = () => {
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            
            // Get last 6 months of data
            const monthlyData = [];
            for (let i = 5; i >= 0; i--) {
                const month = (currentMonth - i + 12) % 12;
                const year = currentMonth - i < 0 ? currentYear - 1 : currentYear;
                const count = records.filter(record => {
                    const date = getRecordDate(record);
                    if (!date) return false;
                    const recordDate = new Date(date);
                    return recordDate.getMonth() === month && recordDate.getFullYear() === year;
                }).length;
                monthlyData.push({ month, year, count });
            }
            
            return monthlyData;
        };
        
        // Basic metrics questions
        if ((lowerQuestion.includes('total') && lowerQuestion.includes('enquir')) || 
            (lowerQuestion.includes('how many') && lowerQuestion.includes('enquir'))) {
            return `📊 Total Enquiries: You have ${records.length} total enquiries in your database.`;
        }
        
        if (lowerQuestion.includes('current month') || lowerQuestion.includes('this month')) {
            const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            return `📅 Current Month (${monthName}): ${metrics.currentMonth} enquiries`;
        }
        
        if (lowerQuestion.includes('last month') || lowerQuestion.includes('previous month')) {
            return `📅 Last Month: ${metrics.lastMonth} enquiries`;
        }
        
        if (lowerQuestion.includes('last year') || lowerQuestion.includes('same month last year')) {
            return `📅 **Same Month Last Year**: ${metrics.sameMonthLastYear} enquiries`;
        }
        
        // Conversion analysis
        if (lowerQuestion.includes('conversion') || lowerQuestion.includes('convert')) {
            if (lowerQuestion.includes('discovery')) {
                return `🎯 **Discovery Call Conversion**: ${metrics.discoveryCallConversion}% (${metrics.currentMonthWithDiscovery} of ${metrics.currentMonth} enquiries)`;
            } else if (lowerQuestion.includes('live')) {
                return `🎯 **Live Call Conversion**: ${metrics.liveCallConversion}% (${metrics.currentMonthWithLiveCall} of ${metrics.currentMonth} enquiries)`;
            } else {
                return `🎯 **Conversion Rates**:
• Discovery Calls: ${metrics.discoveryCallConversion}% (${metrics.currentMonthWithDiscovery}/${metrics.currentMonth})
• Live Calls: ${metrics.liveCallConversion}% (${metrics.currentMonthWithLiveCall}/${metrics.currentMonth})
• Discovery → Live: ${metrics.discoveryToLiveCallConversion}% (${metrics.currentMonthWithBothDiscoveryAndLive}/${metrics.currentMonthWithDiscovery})`;
            }
        }
        
        // Performance analysis
        if (lowerQuestion.includes('performance') || lowerQuestion.includes('how am i doing') || lowerQuestion.includes('trend')) {
            const vsLastYear = metrics.currentMonth > metrics.proratedSameMonthLastYear ? 
                `${Math.round(((metrics.currentMonth - metrics.proratedSameMonthLastYear) / metrics.proratedSameMonthLastYear) * 100)}% ahead` : 
                `${Math.round(((metrics.proratedSameMonthLastYear - metrics.currentMonth) / metrics.proratedSameMonthLastYear) * 100)}% behind`;
            
            const monthlyData = analyzeTrends();
            const trend = monthlyData[monthlyData.length - 1].count > monthlyData[monthlyData.length - 2].count ? '📈 increasing' : '📉 decreasing';
            
            return `📈 **Performance Analysis**:
• Current vs Last Year: ${vsLastYear}
• Current: ${metrics.currentMonth} enquiries vs ${Math.round(metrics.proratedSameMonthLastYear)} expected
• Trend: ${trend}
• Last 3 months average: ${metrics.last3MonthsAverage} enquiries`;
        }
        
        // Source analysis
        if (lowerQuestion.includes('source') || lowerQuestion.includes('where') || lowerQuestion.includes('come from')) {
            if (metrics.topSources && metrics.topSources.length > 0) {
                let response = `🔍 Top Enquiry Sources:\n\n`;
                metrics.topSources.slice(0, 5).forEach((source, index) => {
                    response += `${index + 1}. ${source.source}: ${source.count} enquiries (${source.percentage}%)\n`;
                });
                return response.trim();
            }
            return "🔍 I can see you have enquiry sources, but I need more data to provide specific details.";
        }
        
        // Recent enquiries
        if (lowerQuestion.includes('recent') || lowerQuestion.includes('latest') || lowerQuestion.includes('last')) {
            const sortedRecords = records
                .map(record => ({ record, date: getRecordDate(record) }))
                .filter(item => item.date)
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 5);
            
            if (sortedRecords.length > 0) {
                let response = `📋 Recent Enquiries:\n\n`;
                sortedRecords.forEach((item, index) => {
                    const date = new Date(item.date).toLocaleDateString();
                    const source = getFieldValue(item.record, 'source');
                    const name = getFieldValue(item.record, 'name');
                    const enquiryId = getFieldValue(item.record, 'enquiry id') || getFieldValue(item.record, 'id');
                    
                    response += `${index + 1}. Date: ${date}\n`;
                    response += `   Type: ${source}\n`;
                    if (enquiryId !== 'Field not found' && enquiryId !== 'Not set') {
                        response += `   Enquiry ID: ${enquiryId}\n`;
                    }
                    if (name !== 'Field not found' && name !== 'Not set') {
                        response += `   Company: ${name}\n`;
                    }
                    response += `\n`;
                });
                return response.trim();
            }
            return "📋 I couldn't find any recent enquiries with date information.";
        }
        
        // Field analysis
        if (lowerQuestion.includes('field') || lowerQuestion.includes('column') || lowerQuestion.includes('what data')) {
            const fieldNames = table.fields.map(field => field.name).join(', ');
            return `📝 **Available Fields**: ${fieldNames}\n\nYou can ask me about any of these fields!`;
        }
        
        // Count analysis
        if (lowerQuestion.includes('how many') && lowerQuestion.includes('different')) {
            const fieldNames = table.fields.map(f => f.name.toLowerCase());
            const matchingField = fieldNames.find(fieldName => 
                lowerQuestion.includes(fieldName.split(' ')[0]) || 
                lowerQuestion.includes(fieldName.split(' ')[1])
            );
            
            if (matchingField) {
                const field = table.fields.find(f => f.name.toLowerCase() === matchingField);
                if (field) {
                    const values = records.map(record => record.getCellValue(field)).filter(v => v !== null && v !== undefined);
                    const uniqueValues = [...new Set(values.map(v => typeof v === 'object' && v.name ? v.name : String(v)))];
                    return `🔢 **${field.name} Analysis**: ${uniqueValues.length} unique values\n\nTop values: ${uniqueValues.slice(0, 5).join(', ')}${uniqueValues.length > 5 ? '...' : ''}`;
                }
            }
            return "🔢 I can help you count unique values in fields. Try asking 'How many different sources do we have?' or 'How many different names are there?'";
        }
        
        // Summary/overview
        if (lowerQuestion.includes('summary') || lowerQuestion.includes('overview') || lowerQuestion.includes('dashboard')) {
            return `📊 **Enquiry Dashboard Summary**:
• Total Enquiries: ${records.length}
• Current Month: ${metrics.currentMonth} enquiries
• Discovery Conversion: ${metrics.discoveryCallConversion}%
• Live Call Conversion: ${metrics.liveCallConversion}%
• Top Enquiry Channels: ${metrics.topSources && metrics.topSources.length > 0 ? metrics.topSources[0].source : 'N/A'}
• Performance: ${metrics.currentMonth > metrics.proratedSameMonthLastYear ? 'Ahead of last year' : 'Behind last year'}`;
        }
        
        // Help
        if (lowerQuestion.includes('help') || lowerQuestion.includes('what can you')) {
            return `🤖 **Smart Assistant Help**:

📊 **Metrics**: "How many enquiries?", "Current month performance"
📅 **Time-based**: "Recent enquiries", "Last month trends"  
🎯 **Conversions**: "Conversion rates", "Discovery call conversion"
🔍 **Analysis**: "Top sources", "Field breakdown"
📈 **Trends**: "Performance analysis", "How am I doing?"

Ask me anything about your ${records.length} enquiry records!`;
        }
        
        // Default response
        return `🤖 I can help you analyze your enquiry data! Try asking about:
• "How many enquiries do we have?"
• "What's our conversion rate?"
• "Show me recent enquiries"
• "How are we performing this month?"
• "What are our top sources?"

Or ask for help to see all available commands!`;
    };

    const handleAskQuestion = () => {
        if (!currentQuestion.trim()) return;
        
        const question = currentQuestion.trim();
        const response = getSmartResponse(question, metrics, records, table);
        
        setAssistantMessages(prev => [
            ...prev,
            { type: 'user', message: question },
            { type: 'assistant', message: response }
        ]);
        
        setCurrentQuestion('');
    };
    

    // Helper function to check if date is in a specific month/year
    const isInMonth = (date, year, month) => {
        if (!date) return false;
        const recordDate = new Date(date);
        return recordDate.getFullYear() === year && recordDate.getMonth() === month;
    };

    // Format source names to be more user-friendly
    const formatSourceName = (sourceName) => {
        if (!sourceName) return sourceName;
        
        // Convert to lowercase for processing
        let formatted = sourceName.toLowerCase();
        
        // Handle specific patterns
        if (formatted.includes('web-flowmondo-discovery')) {
            return 'Web flowmondo Discovery';
        }
        if (formatted.includes('web-flowmondo-live')) {
            return 'Web flowmondo Live';
        }
        if (formatted.includes('web-flowmondo-enquiry')) {
            return 'Web flowmondo Enquiry';
        }
        if (formatted.includes('web - flowmondo')) {
            return 'Web flowmondo';
        }
        if (formatted.includes('zapier - contact request')) {
            return 'Zapier Contact Request';
        }
        if (formatted.includes('zapier')) {
            return 'Zapier';
        }
        if (formatted.includes('linkedin')) {
            return 'LinkedIn';
        }
        if (formatted.includes('facebook')) {
            return 'Facebook';
        }
        if (formatted.includes('google')) {
            return 'Google';
        }
        if (formatted.includes('referral')) {
            return 'Referral';
        }
        if (formatted.includes('email')) {
            return 'Email';
        }
        if (formatted.includes('phone')) {
            return 'Phone';
        }
        
        // General formatting: replace hyphens with spaces, capitalize words
        formatted = formatted
            .replace(/-/g, ' ')
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
        return formatted;
    };

    // Helper function to get date from record - prioritize Date Created (imported) over Created (newer)
    const getDateFromRecord = (record) => {
        // Find the date fields - include both DATE and DATETIME types
        const dateCreatedField = table.fields.find(field => 
            (field.type === FieldType.DATE || field.type === FieldType.DATE_TIME) && 
            (field.name.toLowerCase().includes('date created') || 
             field.name.toLowerCase().includes('created date'))
        );
        
        const createdField = table.fields.find(field => 
            (field.type === FieldType.DATE || field.type === FieldType.DATE_TIME) && 
            (field.name.toLowerCase() === 'created' ||
             (field.name.toLowerCase().includes('created') && !field.name.toLowerCase().includes('date')))
        );
        
        // Priority: Date Created (if it has a value) > Created (fallback)
        let dateValue = null;
        
        // First try Date Created field (imported data)
        if (dateCreatedField) {
            const dateCreatedValue = record.getCellValue(dateCreatedField);
            // Only use Date Created if it actually has a value (not null/undefined)
            if (dateCreatedValue !== null && dateCreatedValue !== undefined) {
                dateValue = dateCreatedValue;
            }
        }
        
        // If Date Created is empty/null, try Created field (newer data)
        if ((!dateValue || dateValue === null || dateValue === undefined) && createdField) {
            const createdValue = record.getCellValue(createdField);
            if (createdValue !== null && createdValue !== undefined) {
                dateValue = createdValue;
            }
        }
        
        return dateValue ? new Date(dateValue) : null;
    };

    // Calculate enquiry metrics
    const metrics = useMemo(() => {
        if (records.length === 0) {
            return {
                currentMonth: 0,
                sameMonthLastYear: 0,
                lastMonth: 0,
                last3MonthsAverage: 0
            };
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Current month enquiries
        const currentMonthEnquiries = records.filter(record => {
            const date = getDateFromRecord(record);
            return isInMonth(date, currentYear, currentMonth);
        }).length;

        // Same month last year enquiries
        const sameMonthLastYearEnquiries = records.filter(record => {
            const date = getDateFromRecord(record);
            return isInMonth(date, currentYear - 1, currentMonth);
        }).length;

        // Last month enquiries
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const lastMonthEnquiries = records.filter(record => {
            const date = getDateFromRecord(record);
            return isInMonth(date, lastMonthYear, lastMonth);
        }).length;

        // Last 3 months average
        const last3MonthsEnquiries = [];
        for (let i = 1; i <= 3; i++) {
            const month = currentMonth - i;
            const year = month < 0 ? currentYear - 1 : currentYear;
            const adjustedMonth = month < 0 ? month + 12 : month;
            
            const monthEnquiries = records.filter(record => {
                const date = getDateFromRecord(record);
                return isInMonth(date, year, adjustedMonth);
            }).length;
            
            last3MonthsEnquiries.push(monthEnquiries);
        }
        
        const last3MonthsAverage = last3MonthsEnquiries.reduce((sum, count) => sum + count, 0) / 3;

        // Calculate conversion metrics
        const currentMonthRecords = records.filter(record => {
            const date = getDateFromRecord(record);
            return isInMonth(date, currentYear, currentMonth);
        });

        const discoveryCallField = table.fields.find(field => 
            field.name.toLowerCase().includes('discovery call') ||
            field.name.toLowerCase().includes('discovery') ||
            field.name.toLowerCase().includes('qualification call')
        );

        const liveCallField = table.fields.find(field => 
            field.name.toLowerCase().includes('live call') ||
            field.name.toLowerCase().includes('demo call') ||
            field.name.toLowerCase().includes('presentation call')
        );

        // Calculate conversions for current month
        const currentMonthWithDiscovery = currentMonthRecords.filter(record => {
            if (!discoveryCallField) return false;
            const value = record.getCellValue(discoveryCallField);
            return value !== null && value !== undefined && value !== '';
        }).length;

        const currentMonthWithLiveCall = currentMonthRecords.filter(record => {
            if (!liveCallField) return false;
            const value = record.getCellValue(liveCallField);
            return value !== null && value !== undefined && value !== '';
        }).length;

        const discoveryCallConversion = currentMonthRecords.length > 0 ? 
            Math.round((currentMonthWithDiscovery / currentMonthRecords.length) * 100 * 10) / 10 : 0;

        const liveCallConversion = currentMonthRecords.length > 0 ? 
            Math.round((currentMonthWithLiveCall / currentMonthRecords.length) * 100 * 10) / 10 : 0;

        // Calculate Discovery → Live Call Conversion Rate (records with BOTH discovery and live calls)
        const currentMonthWithBothDiscoveryAndLive = currentMonthRecords.filter(record => {
            const hasDiscovery = discoveryCallField ? 
                record.getCellValue(discoveryCallField) !== null && 
                record.getCellValue(discoveryCallField) !== undefined && 
                record.getCellValue(discoveryCallField) !== '' : false;
            
            const hasLiveCall = liveCallField ? 
                record.getCellValue(liveCallField) !== null && 
                record.getCellValue(liveCallField) !== undefined && 
                record.getCellValue(liveCallField) !== '' : false;
            
            return hasDiscovery && hasLiveCall;
        }).length;

        const discoveryToLiveCallConversion = currentMonthWithDiscovery > 0 ? 
            Math.round((currentMonthWithBothDiscoveryAndLive / currentMonthWithDiscovery) * 100 * 10) / 10 : 0;

        // Calculate source metrics
        const sourceField = table.fields.find(field => 
            field.name.toLowerCase().includes('source') ||
            field.name.toLowerCase().includes('origin') ||
            field.name.toLowerCase().includes('channel')
        );

        const sourceMetrics = {};
        if (sourceField) {
            currentMonthRecords.forEach(record => {
                const sourceValue = record.getCellValue(sourceField);
                if (sourceValue && sourceValue !== null && sourceValue !== undefined) {
                    const sourceName = typeof sourceValue === 'string' ? sourceValue : sourceValue.name || sourceValue.toString();
                    sourceMetrics[sourceName] = (sourceMetrics[sourceName] || 0) + 1;
                }
            });
        }

        // Sort sources by count and get top 5
        const topSources = Object.entries(sourceMetrics)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([source, count]) => ({
                source: formatSourceName(source),
                count,
                percentage: Math.round((count / currentMonthRecords.length) * 100 * 10) / 10
            }));

        // Calculate last month conversion metrics
        const lastMonthRecords = records.filter(record => {
            const date = getDateFromRecord(record);
            return isInMonth(date, lastMonthYear, lastMonth);
        });

        const lastMonthWithDiscovery = lastMonthRecords.filter(record => {
            if (!discoveryCallField) return false;
            const value = record.getCellValue(discoveryCallField);
            return value !== null && value !== undefined && value !== '';
        }).length;

        const lastMonthWithLiveCall = lastMonthRecords.filter(record => {
            if (!liveCallField) return false;
            const value = record.getCellValue(liveCallField);
            return value !== null && value !== undefined && value !== '';
        }).length;

        const lastMonthDiscoveryCallConversion = lastMonthRecords.length > 0 ? 
            Math.round((lastMonthWithDiscovery / lastMonthRecords.length) * 100 * 10) / 10 : 0;

        const lastMonthLiveCallConversion = lastMonthRecords.length > 0 ? 
            Math.round((lastMonthWithLiveCall / lastMonthRecords.length) * 100 * 10) / 10 : 0;

        // Calculate Last Month Discovery → Live Call Conversion Rate
        const lastMonthWithBothDiscoveryAndLive = lastMonthRecords.filter(record => {
            const hasDiscovery = discoveryCallField ? 
                record.getCellValue(discoveryCallField) !== null && 
                record.getCellValue(discoveryCallField) !== undefined && 
                record.getCellValue(discoveryCallField) !== '' : false;
            
            const hasLiveCall = liveCallField ? 
                record.getCellValue(liveCallField) !== null && 
                record.getCellValue(liveCallField) !== undefined && 
                record.getCellValue(liveCallField) !== '' : false;
            
            return hasDiscovery && hasLiveCall;
        }).length;

        const lastMonthDiscoveryToLiveCallConversion = lastMonthWithDiscovery > 0 ? 
            Math.round((lastMonthWithBothDiscoveryAndLive / lastMonthWithDiscovery) * 100 * 10) / 10 : 0;

        // Calculate prorated comparisons for Performance Insights
        const currentDate = new Date();
        const currentDay = currentDate.getDate();
        const daysInCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        
        // Prorated same month last year: (current day / total days) * same month last year
        const proratedSameMonthLastYear = (currentDay / daysInCurrentMonth) * sameMonthLastYearEnquiries;
        
        // Prorated last month: (current day / total days) * last month
        const proratedLastMonth = (currentDay / daysInCurrentMonth) * lastMonthEnquiries;
        
        // Prorated 3-month average: (current day / total days) * 3-month average
        const prorated3MonthAverage = (currentDay / daysInCurrentMonth) * last3MonthsAverage;

        // For conversion rate comparisons, we compare current month's rate to last month's full rate
        // This shows how conversion performance is trending month-over-month

        return {
            currentMonth: currentMonthEnquiries,
            sameMonthLastYear: sameMonthLastYearEnquiries,
            lastMonth: lastMonthEnquiries,
            last3MonthsAverage: Math.round(last3MonthsAverage * 10) / 10,
            discoveryCallConversion,
            liveCallConversion,
            discoveryToLiveCallConversion,
            currentMonthWithDiscovery,
            currentMonthWithLiveCall,
            currentMonthWithBothDiscoveryAndLive,
            proratedSameMonthLastYear,
            proratedLastMonth,
            prorated3MonthAverage,
            topSources,
            totalSources: Object.keys(sourceMetrics).length,
            lastMonthDiscoveryCallConversion,
            lastMonthLiveCallConversion,
            lastMonthDiscoveryToLiveCallConversion
        };
    }, [records, customPropertyValueByKey.dateField]);

    // Format month names
    const getMonthName = (monthIndex) => {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[monthIndex];
    };

    const currentMonthName = getMonthName(new Date().getMonth());
    const lastMonthName = getMonthName(new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1);

    // Check if there are any date fields in the table
    const dateFields = table.fields.filter(field => 
        field.type === FieldType.DATE || field.type === FieldType.DATE_TIME
    );
    const hasDateFields = dateFields.length > 0;
    
    // Check for automatic date field detection
    const dateCreatedField = table.fields.find(field => 
        (field.type === FieldType.DATE || field.type === FieldType.DATE_TIME) && 
        field.name.toLowerCase().includes('date created')
    );
    const createdField = table.fields.find(field => 
        (field.type === FieldType.DATE || field.type === FieldType.DATE_TIME) && 
        field.name.toLowerCase() === 'created'
    );
    const hasAutoDetectedFields = dateCreatedField || createdField;

    // Show configuration message if no date field is selected or no date fields exist
    if (errorState || (!customPropertyValueByKey.dateField && !hasAutoDetectedFields)) {
        return (
            <div className="p-6 min-h-screen" style={{backgroundColor: '#ffffff'}}>
                <div className="max-w-4xl mx-auto">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                        <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                            Configuration Required
                        </h2>
                        {!hasDateFields ? (
                            <div>
                                <p className="text-yellow-700 dark:text-yellow-300 mb-4">
                                    Your table doesn't have any date fields. To use this enquiry dashboard, you need to:
                                </p>
                                <ol className="list-decimal list-inside text-yellow-700 dark:text-yellow-300 space-y-2">
                                    <li>Add a date field to your table (e.g., "Created Date", "Enquiry Date")</li>
                                    <li>Make sure your records have dates in this field</li>
                                    <li>Refresh this Interface Extension</li>
                                </ol>
                                <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-800/30 rounded border border-yellow-300 dark:border-yellow-700">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                        <strong>Tip:</strong> You can add a "Created Date" field and use Airtable's automatic timestamp feature to track when records were created.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-yellow-700 dark:text-yellow-300">
                                Please configure the Date Field in the Interface Extension settings to display enquiry metrics.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 min-h-screen" style={{backgroundColor: '#ffffff'}}>
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                                Enquiry Dashboard
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                Track your enquiry metrics and trends
                            </p>
                        </div>
                        <button 
                            onClick={() => setShowAssistant(!showAssistant)}
                            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Smart Assistant
                        </button>
                    </div>
                    {(() => {
                        const dateCreatedField = table.fields.find(field => 
                            (field.type === FieldType.DATE || field.type === FieldType.DATE_TIME) && 
                            (field.name.toLowerCase().includes('date created') || 
                             field.name.toLowerCase().includes('created date'))
                        );
                        const createdField = table.fields.find(field => 
                            (field.type === FieldType.DATE || field.type === FieldType.DATE_TIME) && 
                            (field.name.toLowerCase() === 'created' ||
                             (field.name.toLowerCase().includes('created') && !field.name.toLowerCase().includes('date')))
                        );
                        const customField = customPropertyValueByKey.dateField;
                        
                        let fieldName = '';
                        if (dateCreatedField && createdField) {
                            fieldName = `${dateCreatedField.name} (imported) / ${createdField.name} (newer)`;
                        } else if (dateCreatedField) {
                            fieldName = dateCreatedField.name;
                        } else if (createdField) {
                            fieldName = createdField.name;
                        } else if (customField) {
                            fieldName = customField.name;
                        }
                        
                        {/* return fieldName ? (
                            <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Using: {fieldName}
                            </div>
                        ) : null; */}
                    })()}
                    
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* Current Month */}
                    <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {currentMonthName} {new Date().getFullYear()}
                                </p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {metrics.currentMonth}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Same Month Last Year */}
                    <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {currentMonthName} {new Date().getFullYear() - 1}
                                </p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {metrics.sameMonthLastYear}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Last Month */}
                    <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {lastMonthName} {new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear()}
                                </p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {metrics.lastMonth}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Last 3 Months Average */}
                    <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Last 3 Months Avg
                                </p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {metrics.last3MonthsAverage}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Performance Insights */}
                <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Enquiries Performance Insights
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center">
                            <div className={`text-2xl font-bold mb-1 ${
                                metrics.currentMonth > metrics.proratedSameMonthLastYear ? 
                                    'text-green-600 dark:text-green-400' : 
                                    'text-red-600 dark:text-red-400'
                            }`}>
                                {metrics.currentMonth > metrics.proratedSameMonthLastYear ? '+' : ''}
                                {metrics.proratedSameMonthLastYear > 0 ? 
                                    Math.round(((metrics.currentMonth - metrics.proratedSameMonthLastYear) / metrics.proratedSameMonthLastYear) * 100) : 
                                    metrics.currentMonth > 0 ? 100 : 0
                                }%
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                vs Same Month Last Year
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                (prorated to day {new Date().getDate()})
                            </p>
                        </div>
                        <div className="text-center">
                            <div className={`text-2xl font-bold mb-1 ${
                                metrics.currentMonth > metrics.proratedLastMonth ? 
                                    'text-green-600 dark:text-green-400' : 
                                    'text-red-600 dark:text-red-400'
                            }`}>
                                {metrics.currentMonth > metrics.proratedLastMonth ? '+' : ''}
                                {metrics.proratedLastMonth > 0 ? 
                                    Math.round(((metrics.currentMonth - metrics.proratedLastMonth) / metrics.proratedLastMonth) * 100) : 
                                    metrics.currentMonth > 0 ? 100 : 0
                                }%
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                vs Last Month
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                (prorated to day {new Date().getDate()})
                            </p>
                        </div>
                        <div className="text-center">
                            <div className={`text-2xl font-bold mb-1 ${
                                metrics.currentMonth > metrics.prorated3MonthAverage ? 
                                    'text-green-600 dark:text-green-400' : 
                                    'text-red-600 dark:text-red-400'
                            }`}>
                                {metrics.currentMonth > metrics.prorated3MonthAverage ? '+' : ''}
                                {metrics.prorated3MonthAverage > 0 ? 
                                    Math.round(((metrics.currentMonth - metrics.prorated3MonthAverage) / metrics.prorated3MonthAverage) * 100) : 
                                    metrics.currentMonth > 0 ? 100 : 0
                                }%
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                vs 3-Month Average
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                (prorated to day {new Date().getDate()})
                            </p>
                        </div>
                    </div>
                </div>

                {/* Conversion Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Discovery Call Conversion */}
                    <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Discovery Call Conversion
                                </p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {metrics.discoveryCallConversion}%
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {metrics.currentMonthWithDiscovery} of {metrics.currentMonth} enquiries
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Live Call Conversion */}
                    <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Live Call Conversion
                                </p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {metrics.liveCallConversion}%
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {metrics.currentMonthWithLiveCall} of {metrics.currentMonth} enquiries
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Discovery → Live Call Conversion */}
                    <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Discovery → Live Call
                                </p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {metrics.discoveryToLiveCallConversion}%
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {metrics.currentMonthWithBothDiscoveryAndLive} of {metrics.currentMonthWithDiscovery} discovery calls
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Conversion Performance Insights */}
                <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Conversion Performance Insights
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center">
                            <div className={`text-2xl font-bold mb-1 ${
                                metrics.discoveryCallConversion > metrics.lastMonthDiscoveryCallConversion ? 
                                    'text-green-600 dark:text-green-400' : 
                                    'text-red-600 dark:text-red-400'
                            }`}>
                                {metrics.discoveryCallConversion > metrics.lastMonthDiscoveryCallConversion ? '+' : ''}
                                {metrics.lastMonthDiscoveryCallConversion > 0 ? 
                                    Math.round(((metrics.discoveryCallConversion - metrics.lastMonthDiscoveryCallConversion) / metrics.lastMonthDiscoveryCallConversion) * 100) : 
                                    metrics.discoveryCallConversion > 0 ? 100 : 0
                                }%
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Discovery Call Conversion
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                vs Last Month ({metrics.lastMonthDiscoveryCallConversion}% → {metrics.discoveryCallConversion}%)
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                (prorated to day {new Date().getDate()})
                            </p>
                        </div>
                        <div className="text-center">
                            <div className={`text-2xl font-bold mb-1 ${
                                metrics.liveCallConversion > metrics.lastMonthLiveCallConversion ? 
                                    'text-green-600 dark:text-green-400' : 
                                    'text-red-600 dark:text-red-400'
                            }`}>
                                {metrics.liveCallConversion > metrics.lastMonthLiveCallConversion ? '+' : ''}
                                {metrics.lastMonthLiveCallConversion > 0 ? 
                                    Math.round(((metrics.liveCallConversion - metrics.lastMonthLiveCallConversion) / metrics.lastMonthLiveCallConversion) * 100) : 
                                    metrics.liveCallConversion > 0 ? 100 : 0
                                }%
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Live Call Conversion
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                vs Last Month ({metrics.lastMonthLiveCallConversion}% → {metrics.liveCallConversion}%)
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                (prorated to day {new Date().getDate()})
                            </p>
                        </div>
                        <div className="text-center">
                            <div className={`text-2xl font-bold mb-1 ${
                                metrics.discoveryToLiveCallConversion > metrics.lastMonthDiscoveryToLiveCallConversion ? 
                                    'text-green-600 dark:text-green-400' : 
                                    'text-red-600 dark:text-red-400'
                            }`}>
                                {metrics.discoveryToLiveCallConversion > metrics.lastMonthDiscoveryToLiveCallConversion ? '+' : ''}
                                {metrics.lastMonthDiscoveryToLiveCallConversion > 0 ? 
                                    Math.round(((metrics.discoveryToLiveCallConversion - metrics.lastMonthDiscoveryToLiveCallConversion) / metrics.lastMonthDiscoveryToLiveCallConversion) * 100) : 
                                    metrics.discoveryToLiveCallConversion > 0 ? 100 : 0
                                }%
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Discovery → Live Call Conversion
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                vs Last Month ({metrics.lastMonthDiscoveryToLiveCallConversion}% → {metrics.discoveryToLiveCallConversion}%)
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                (prorated to day {new Date().getDate()})
                            </p>
                        </div>
                    </div>
                </div>

                {/* Source Analysis */}
                {metrics.topSources && metrics.topSources.length > 0 && (
                    <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-6 mb-8">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Top Enquiry Channels ({metrics.totalSources} total)
                        </h3>
                        <div className="space-y-3">
                            {metrics.topSources.map((sourceData, index) => (
                                <div key={sourceData.source} className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold mr-3 ${
                                            index === 0 ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                                            index === 1 ? 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200' :
                                            index === 2 ? 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200' :
                                            'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                        }`}>
                                            {index + 1}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {sourceData.source}
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {sourceData.percentage}% of enquiries
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {sourceData.count}
                                        </p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            enquiries
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Smart Assistant Interface */}
                {showAssistant && (
                    <div className="fixed bottom-4 right-4 w-96 h-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 flex flex-col z-50">
                        {/* Chat Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Smart Assistant</h3>
                            <button 
                                onClick={() => setShowAssistant(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        {/* Assistant Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {assistantMessages.length === 0 && (
                                <div className="text-center text-gray-500 dark:text-gray-400">
                                    <p className="mb-2">👋 Hi! I'm your AI assistant.</p>
                                    <p className="text-sm">Ask me about your enquiry data:</p>
                                    <ul className="text-xs mt-2 space-y-1">
                                        <li>• "How many enquiries do we have?"</li>
                                        <li>• "What's our conversion rate?"</li>
                                        <li>• "How are we performing this month?"</li>
                                        <li>• "What are our top sources?"</li>
                                    </ul>
                                </div>
                            )}
                            
                            {assistantMessages.map((msg, index) => (
                                <div key={index} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-xs px-3 py-2 rounded-lg ${
                                        msg.type === 'user' 
                                            ? 'bg-blue-600 text-white' 
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                                    }`}>
                                        <p className="text-sm">{msg.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {/* Assistant Input */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-600">
                            <div className="flex space-x-2">
                                <input
                                    type="text"
                                    value={currentQuestion}
                                    onChange={(e) => setCurrentQuestion(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                                    placeholder="Ask about your enquiry data..."
                                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                />
                                <button
                                    onClick={handleAskQuestion}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

   
            </div>
        </div>
    );
}

initializeBlock({interface: () => <EnquiryDashboard />});
