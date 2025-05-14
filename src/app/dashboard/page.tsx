'use client';

import { fetchDailyExpenses, calculateSummaryFromDaily, calculateExpensesByCategory } from "./services/dashboardService";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import ExpensesChart from "./components/ExpensesChart";
import MonthPicker from "./components/MonthPicker";

interface SummaryData {
  totalExpenses: number;
  totalIncome: number;
  totalTransfer: number;
  expensesByCategory: { _id: string; type: string; total: number }[];
  expensesOverTime: {
    date: string;
    total: number;
    transaction_count: number;
    income: number;
    expense: number;
    transactions?: {
      _id: string;
      amount: number;
      type: string;
      category: string | null;
      time: string;
      description: string | null;

    }[];
    category_summary: {
      category: string | null;
      total: number;
      count: number;
      type: string;
      transactions: {
        amount: number;
        description: string | null;
      }[];
    }[];
  }[];
}

const DashboardPage = () => {
  const searchParams = useSearchParams();

  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [activeTab, setActiveTab] = useState<'categories' | 'accounts' | 'charts'>('categories');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [expandedTransactions, setExpandedTransactions] = useState<{[key: string]: boolean}>({});
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = window.localStorage.getItem("theme");
      setIsDarkMode(savedTheme === "dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = !isDarkMode ? "dark" : "light";
    setIsDarkMode(!isDarkMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("theme", nextTheme);
    }
  };

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      try {
        const expirationTime = JSON.parse(atob(token.split('.')[1])).exp * 1000; // Convert to milliseconds
        
        // Check if token is expired
        if (Date.now() > expirationTime) {
          window.location.href = "/login?error=expired_token";
          return;
        }
        
        fetchDailyExpenses(token, selectedMonth, selectedYear)
          .then((dailyExpenses) => {
            const summary = calculateSummaryFromDaily(dailyExpenses);
            const expensesByCategory = calculateExpensesByCategory(dailyExpenses);
            
            setSummaryData({
              ...summary,
              expensesOverTime: dailyExpenses,
              expensesByCategory: expensesByCategory,
            });
            setError(null); // Clear any previous errors
          })
          .catch((error) => {
            console.error("Error fetching data", error);
            setError("Failed to fetch dashboard data. Please try again later.");
          });
      } catch (error) {
        console.error("Error decoding token", error);
        setError("Invalid authentication token. Please try logging in again.");
      }
    } else {
      // Redirect to login if no token is provided
      window.location.href = "/login";
    }
  }, [searchParams, selectedMonth, selectedYear]); // Add date selection dependencies

  // Calculate total balance
  const totalBalance = summaryData ? summaryData.totalIncome - summaryData.totalExpenses - summaryData.totalTransfer : 0;



  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="container mx-auto px-4 py-4 md:py-6 max-w-full sm:max-w-xl md:max-w-2xl lg:max-w-4xl">
        {/* Header with balance summary */}
        <div className={`mb-6 bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-4 md:p-6 shadow-lg ${isDarkMode ? 'dark:bg-gray-800' : ''}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg md:text-xl font-medium text-blue-100">Total Balance</h2>
            <MonthPicker
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onChange={(month, year) => {
                setSelectedMonth(month);
                setSelectedYear(year);
              }}
              isDarkMode={isDarkMode}
            />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-white mt-1">Rp {totalBalance.toLocaleString()}</p>
          
          <div className="grid grid-cols-3 gap-2 md:gap-4 mt-4 md:mt-6">
            <div className="text-center p-2 rounded-lg bg-blue-700/30">
              <p className="text-blue-200 text-xs md:text-sm">Income</p>
              <p className="text-white font-semibold text-sm md:text-base">Rp {summaryData?.totalIncome.toLocaleString() || '0'}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-blue-700/30">
              <p className="text-blue-200 text-xs md:text-sm">Expenses</p>
              <p className="text-white font-semibold text-sm md:text-base">Rp {summaryData?.totalExpenses.toLocaleString() || '0'}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-blue-700/30">
              <p className="text-blue-200 text-xs md:text-sm">Transfer</p>
              <p className="text-white font-semibold text-sm md:text-base">Rp {summaryData?.totalTransfer.toLocaleString() || '0'}</p>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className={`flex border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-300'} mb-6`}>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'categories' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => setActiveTab('categories')}
          >
            Categories
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'accounts' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => setActiveTab('accounts')}
          >
            Accounts
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'charts' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => setActiveTab('charts')}
          >
            Charts
          </button>
        </div>

        {/* Tab content */}
        <div className="mb-6">
          {activeTab === 'categories' && (
            <div>
              <h3 className="text-xl font-semibold mb-4">Transaction Categories</h3>
              {summaryData?.expensesByCategory ? (
                <div className={`space-y-4 ${isDarkMode ? 'dark:text-gray-100' : 'text-gray-900'}`}>
                  {/* Sort categories by total amount and get top 5 */}
                  {summaryData.expensesByCategory
                    .sort((a, b) => (b.total || 0) - (a.total || 0))
                    .slice(0, 5)
                    .map((category, index) => {
                      const categoryName = category._id === null ? 'Uncategorized' : category._id;
                      const isIncome = category.type === 'income';
                      return (
                        <div key={index} className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg p-4 shadow-sm border transition-all hover:shadow-md`}>
                          <div className="flex justify-between items-center">
                            <span className="font-medium capitalize">{categoryName}</span>
                            <span className={`font-medium ${isIncome ? 'text-green-500' : 'text-red-500'}`}>
                              Rp {category.total?.toLocaleString() || '0'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  
                  {/* Show more/less button if there are more than 5 categories */}
                  {summaryData.expensesByCategory.length > 5 && (
                    <button
                      onClick={() => setExpandedTransactions(prev => ({ ...prev, categories: !prev.categories }))}
                      className={`w-full py-2 px-4 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 border-gray-700' : 'bg-white hover:bg-gray-50 border-gray-200'} border rounded-lg flex items-center justify-center gap-2 transition-colors`}
                    >
                      <span>{expandedTransactions.categories ? 'Show Less' : `Show ${summaryData.expensesByCategory.length - 5} More`}</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${expandedTransactions.categories ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Show remaining categories when expanded */}
                  {expandedTransactions.categories && summaryData.expensesByCategory.length > 5 && (
                    <div className="space-y-4 mt-4">
                      {summaryData.expensesByCategory
                        .sort((a, b) => (b.total || 0) - (a.total || 0))
                        .slice(5)
                        .map((category, index) => {
                          const categoryName = category._id === null ? 'Uncategorized' : category._id;
                          const isIncome = category.type === 'income';
                          return (
                            <div key={index} className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg p-4 shadow-sm border transition-all hover:shadow-md`}>
                              <div className="flex justify-between items-center">
                                <span className="font-medium capitalize">{categoryName}</span>
                                <span className={`font-medium ${isIncome ? 'text-green-500' : 'text-red-500'}`}>
                                  Rp {category.total?.toLocaleString() || '0'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Loading categories...</p>
              )}

              {/* Recent transactions section */}
              <div className="mt-8">
                <h3 className="text-xl font-semibold mb-4">Recent Transactions</h3>
                {summaryData?.expensesOverTime && summaryData.expensesOverTime.length > 0 ? (
                  <div className="space-y-4">
                    {summaryData.expensesOverTime.slice(0, 5).map((expense, index) => {
                      // Transaction expansion state

                      const isExpanded = expandedTransactions[expense.date] || false;
                      const transactionCount = expense.transactions?.length || 0;
                      
                      return (
                        <div key={index} className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg p-4 shadow-sm border transition-all hover:shadow-md cursor-pointer`}
                             onClick={() => setExpandedTransactions(prev => ({ ...prev, [expense.date]: !prev[expense.date] }))}>
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{expense.date}</span>
                              <span className="text-sm text-gray-500">({transactionCount} transaction{transactionCount !== 1 ? 's' : ''})</span>
                            </div>
                            <svg
                              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                          
                          {/* Expanded details */}
                          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 mt-4' : 'max-h-0'}`}>
                            {expense.transactions && expense.transactions.length > 0 ? (
                              <div className="space-y-2 pl-4 border-l-2 border-gray-300 dark:border-gray-600">
                                {expense.transactions.map((transaction, detailIndex) => (
                                  <div key={detailIndex} className="flex justify-between items-center text-sm">
                                    <div className="flex-1">
                                      <p className="font-medium">{transaction.category || 'Uncategorized'}</p>
                                      <p className="text-gray-500 dark:text-gray-400">{transaction.description || 'No description'}</p>
                                      <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                        <span className="capitalize">{transaction.type}</span>

                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className={`font-medium ${transaction.type.toLowerCase() === 'expense' || transaction.type.toLowerCase() === 'transfer' ? 'text-red-500 dark:text-red-400' : transaction.type.toLowerCase() === 'income' ? 'text-green-500 dark:text-green-400' : ''}`}>
                                        Rp {transaction.amount ? transaction.amount.toLocaleString() : '0'}
                                      </p>
                                      <p className="text-gray-500 dark:text-gray-400">{transaction.time}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-500 dark:text-gray-400 text-sm">No transactions available for this day.</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No recent expenses found.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'accounts' && (
            <div>
              <h3 className="text-xl font-semibold mb-4">Account Statistics</h3>
              {summaryData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Transaction Type Distribution */}
                  <div className={`p-4 rounded-lg shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <h4 className="text-lg font-medium mb-3">Transaction Distribution</h4>
                    <div className="space-y-3">
                      {['income', 'expense', 'transfer'].map((type) => {
                        const typeTotal = summaryData.expensesByCategory
                          .filter(cat => cat.type === type)
                          .reduce((sum, cat) => sum + cat.total, 0);
                        const percentage = summaryData.expensesByCategory.length > 0
                          ? ((typeTotal / (summaryData.totalIncome + summaryData.totalExpenses + summaryData.totalTransfer)) * 100).toFixed(1)
                          : '0';
                        return (
                          <div key={type} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${type === 'income' ? 'bg-green-500' : type === 'expense' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                              <span className="capitalize">{type}</span>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">Rp {typeTotal.toLocaleString()}</p>
                              <p className="text-sm text-gray-500">{percentage}%</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Transaction Statistics */}
                  <div className={`p-4 rounded-lg shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <h4 className="text-lg font-medium mb-3">Transaction Statistics</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span>Total Transactions</span>
                        <span className="font-medium">
                          {summaryData.expensesOverTime.reduce((sum, day) => sum + (day.transactions?.length || 0), 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Categories Used</span>
                        <span className="font-medium">
                          {new Set(summaryData.expensesByCategory.map(cat => cat._id)).size}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Average Transaction</span>
                        <span className="font-medium">
                          Rp {(summaryData.totalExpenses / (summaryData.expensesOverTime.reduce((sum, day) => sum + (day.transactions?.length || 0), 0) || 1)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Loading account statistics...</p>
              )}
            </div>
          )}

          {activeTab === 'charts' && (
            <div>
              <h3 className="text-xl font-semibold mb-4">Expense Breakdown</h3>
              {summaryData?.expensesOverTime ? (
                <div className={`p-4 rounded-lg shadow-sm border ${isDarkMode ? 'dark:border-gray-700 dark:bg-gray-800' : 'border-gray-200 bg-white'}`}>
                  <ExpensesChart data={summaryData.expensesOverTime} />
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Loading chart...</p>
              )}
            </div>
          )}
        </div>

        {/* Theme toggle button */}
        <div className="mt-8 text-center">
          <button
            onClick={toggleTheme}
            className={`px-4 py-2 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg transition-colors shadow-sm flex items-center mx-auto gap-2 justify-center`}
          >
            {isDarkMode ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
                <span>Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
