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
    transactions?: Transaction[];
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

interface Transaction {
  _id?: string;
  id?: string;
  amount: number;
  type: string;
  category: string | null;
  time: string;
  description: string | null;
}

// Helper function to get emoji for categories
const getCategoryEmoji = (category: string): string => {
  const categoryLower = category?.toLowerCase() || '';
  
  if (categoryLower.includes('food') || categoryLower.includes('restaurant') || categoryLower.includes('dining')) return '🍽️';
  if (categoryLower.includes('transport') || categoryLower.includes('travel') || categoryLower.includes('uber') || categoryLower.includes('taxi')) return '🚗';
  if (categoryLower.includes('grocery') || categoryLower.includes('groceries') || categoryLower.includes('supermarket')) return '🛒';
  if (categoryLower.includes('entertainment') || categoryLower.includes('movie') || categoryLower.includes('game')) return '🎮';
  if (categoryLower.includes('salary') || categoryLower.includes('income') || categoryLower.includes('freelance')) return '💰';
  if (categoryLower.includes('transfer') || categoryLower.includes('internal')) return '🔄';
  if (categoryLower.includes('shopping') || categoryLower.includes('clothes') || categoryLower.includes('fashion')) return '🛍️';
  if (categoryLower.includes('health') || categoryLower.includes('medical') || categoryLower.includes('doctor')) return '🏥';
  if (categoryLower.includes('education') || categoryLower.includes('course') || categoryLower.includes('book')) return '📚';
  if (categoryLower.includes('utility') || categoryLower.includes('bill') || categoryLower.includes('electric')) return '⚡';
  if (categoryLower.includes('coffee') || categoryLower.includes('cafe') || categoryLower.includes('starbucks')) return '☕';
  if (categoryLower === 'uncategorized' || categoryLower === '') return '❓';
  
  return '💳'; // Default emoji
};

// API functions for transaction operations
const deleteTransaction = async (transactionId: string, token: string) => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/transactions/${transactionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete transaction');
  }
  
  return response.json();
};

const updateTransaction = async (transactionId: string, token: string, data: { items: { name: string; price: number; quantity: number; type: string }[] }) => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/transactions/${transactionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch {
        errorText = 'Unable to read error response';
      }
      throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to update transaction'}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error in updateTransaction:', error);
    throw error;
  }
};

const DashboardPage = () => {
  const searchParams = useSearchParams();

  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [activeTab, setActiveTab] = useState<'categories' | 'accounts' | 'charts'>('categories');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [expandedTransactions, setExpandedTransactions] = useState<{[key: string]: boolean}>({});
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{name: string, price: number, quantity: number, type: string}>({
    name: '',
    price: 0,
    quantity: 1,
    type: 'expense'
  });
  const [isLoading, setIsLoading] = useState(false);

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
        const expirationTime = JSON.parse(atob(token.split('.')[1])).exp * 1000;
        
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
            setError(null);
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
      window.location.href = "/login";
    }
  }, [searchParams, selectedMonth, selectedYear]);

  const totalBalance = summaryData ? summaryData.totalIncome - summaryData.totalExpenses - summaryData.totalTransfer : 0;

  const handleDeleteTransaction = async (transactionId: string) => {
    const token = searchParams.get("token");
    if (!token) return;

    if (!confirm('Are you sure you want to delete this transaction?')) return;

    setIsLoading(true);
    try {
      await deleteTransaction(transactionId, token);
      await refreshData(token);
      setError(null);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      setError('Failed to delete transaction. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    const transactionId = transaction._id || transaction.id;
    
    if (!transactionId) {
      console.error('Transaction missing _id and id:', transaction);
      setError('Transaction ID is missing');
      return;
    }
    
    // Determine the transaction type
    let transactionType = 'expense'; // default
    if (transaction.type.toLowerCase() === 'income') {
      transactionType = 'income';
    } else if (transaction.type.toLowerCase() === 'transfer') {
      transactionType = 'transfer';
    }
    
    setEditingTransaction(transactionId);
    setEditFormData({
      name: transaction.description || transaction.category || '',
      price: transaction.amount || 0,
      quantity: 1,
      type: transactionType
    });
  };

  const handleSaveEdit = async () => {
    try {
      const token = searchParams.get("token");
      
      if (!token || !editingTransaction) {
        setError('Missing authentication token or transaction ID');
        return;
      }

      if (!editFormData.name || !editFormData.name.trim()) {
        setError('Description cannot be empty');
        return;
      }

      if (!editFormData.price || editFormData.price <= 0) {
        setError('Amount must be greater than 0');
        return;
      }

      setIsLoading(true);
      setError(null);
      
      const updateData = {
        items: [{
          name: editFormData.name.trim(),
          price: Number(editFormData.price),
          quantity: Number(editFormData.quantity) || 1,
          type: editFormData.type
        }]
      };
      
      await updateTransaction(editingTransaction, token, updateData);
      await refreshData(token);
      setEditingTransaction(null);
      setError(null);
      
    } catch (error) {
      console.error('Error in handleSaveEdit:', error);
      setError(`Failed to update transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async (token: string) => {
    try {
      const dailyExpenses = await fetchDailyExpenses(token, selectedMonth, selectedYear);
      const summary = calculateSummaryFromDaily(dailyExpenses);
      const expensesByCategory = calculateExpensesByCategory(dailyExpenses);
      
      setSummaryData({
        ...summary,
        expensesOverTime: dailyExpenses,
        expensesByCategory: expensesByCategory,
      });
    } catch (error) {
      console.error("Error refreshing data", error);
      setError("Failed to refresh data. Please try again later.");
    }
  };

  return (
    <div className={`min-h-screen transition-all duration-300 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {error && (
        <div className="bg-red-500 text-white px-6 py-4 rounded-xl relative mb-6 mx-4 shadow-lg" role="alert">
          <span className="block sm:inline font-medium">{error}</span>
        </div>
      )}

      <div className="container mx-auto px-4 py-6 md:py-8 max-w-full sm:max-w-xl md:max-w-2xl lg:max-w-4xl">
        {/* Header with balance summary */}
        <div className={`mb-8 ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'} rounded-2xl p-6 md:p-8 shadow-lg transition-all duration-300 hover:shadow-xl`}>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold mb-2">
                💰 Total Balance
              </h2>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Live Balance</span>
              </div>
            </div>
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
          <p className="text-3xl md:text-4xl font-bold mt-2 mb-6">
            Rp {totalBalance.toLocaleString()}
          </p>
          
          <div className="grid grid-cols-3 gap-3 md:gap-6 mt-6">
            <div className={`text-center p-4 rounded-xl ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'} transition-all duration-300 hover:scale-105`}>
              <div className="text-2xl mb-2">📈</div>
              <p className={`text-xs md:text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Income</p>
              <p className="font-semibold text-sm md:text-base">Rp {summaryData?.totalIncome.toLocaleString() || '0'}</p>
            </div>
            <div className={`text-center p-4 rounded-xl ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'} transition-all duration-300 hover:scale-105`}>
              <div className="text-2xl mb-2">💸</div>
              <p className={`text-xs md:text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Expenses</p>
              <p className="font-semibold text-sm md:text-base">Rp {summaryData?.totalExpenses.toLocaleString() || '0'}</p>
            </div>
            <div className={`text-center p-4 rounded-xl ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'} transition-all duration-300 hover:scale-105`}>
              <div className="text-2xl mb-2">🔄</div>
              <p className={`text-xs md:text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Transfer</p>
              <p className="font-semibold text-sm md:text-base">Rp {summaryData?.totalTransfer.toLocaleString() || '0'}</p>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className={`flex ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} border-b-2 mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-t-2xl p-2 shadow-sm`}>
          <button
            className={`px-6 py-3 font-medium rounded-xl transition-all duration-300 transform hover:scale-105 ${
              activeTab === 'categories' 
                ? `${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white shadow-lg font-semibold` 
                : `${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`
            }`}
            onClick={() => setActiveTab('categories')}
          >
            📊 Categories
          </button>
          <button
            className={`px-6 py-3 font-medium rounded-xl transition-all duration-300 transform hover:scale-105 ${
              activeTab === 'accounts' 
                ? `${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white shadow-lg font-semibold` 
                : `${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`
            }`}
            onClick={() => setActiveTab('accounts')}
          >
            💳 Accounts
          </button>
          <button
            className={`px-6 py-3 font-medium rounded-xl transition-all duration-300 transform hover:scale-105 ${
              activeTab === 'charts' 
                ? `${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white shadow-lg font-semibold` 
                : `${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`
            }`}
            onClick={() => setActiveTab('charts')}
          >
            📈 Charts
          </button>
        </div>

        {/* Tab content */}
        <div className="mb-8">
          {activeTab === 'categories' && (
            <div>
              <h3 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                <span className="text-3xl">🏷️</span>
                Transaction Categories
              </h3>
              {summaryData?.expensesByCategory ? (
                <div className="space-y-4">
                  {summaryData.expensesByCategory
                    .sort((a, b) => (b.total || 0) - (a.total || 0))
                    .slice(0, 5)
                    .map((category, index) => {
                      const categoryName = category._id === null ? 'Uncategorized' : category._id;
                      const isIncome = category.type === 'income';
                      const categoryEmoji = getCategoryEmoji(categoryName);
                      return (
                        <div key={index} className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl p-6 shadow-lg border transition-all duration-300 hover:shadow-xl hover:scale-[1.02] transform`}>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                              <span className="text-3xl">{categoryEmoji}</span>
                              <span className="font-medium text-lg capitalize">{categoryName}</span>
                            </div>
                            <div className="text-right">
                              <span className={`font-bold text-xl px-4 py-2 rounded-full ${
                                isIncome 
                                  ? `text-green-600 ${isDarkMode ? 'bg-green-900/30' : 'bg-green-100'}` 
                                  : `text-red-600 ${isDarkMode ? 'bg-red-900/30' : 'bg-red-100'}`
                              }`}>
                                Rp {category.total?.toLocaleString() || '0'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  
                  {summaryData.expensesByCategory.length > 5 && (
                    <button
                      onClick={() => setExpandedTransactions(prev => ({ ...prev, categories: !prev.categories }))}
                      className={`w-full py-4 px-6 ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 transform hover:scale-105 shadow-lg font-medium`}
                    >
                      <span>{expandedTransactions.categories ? '🔼 Show Less' : `🔽 Show ${summaryData.expensesByCategory.length - 5} More`}</span>
                    </button>
                  )}
                  
                  {expandedTransactions.categories && summaryData.expensesByCategory.length > 5 && (
                    <div className="space-y-4 mt-6">
                      {summaryData.expensesByCategory
                        .sort((a, b) => (b.total || 0) - (a.total || 0))
                        .slice(5)
                        .map((category, index) => {
                          const categoryName = category._id === null ? 'Uncategorized' : category._id;
                          const isIncome = category.type === 'income';
                          const categoryEmoji = getCategoryEmoji(categoryName);
                          return (
                            <div key={index} className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl p-6 shadow-lg border transition-all duration-300 hover:shadow-xl hover:scale-[1.02] transform`}>
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                  <span className="text-3xl">{categoryEmoji}</span>
                                  <span className="font-medium text-lg capitalize">{categoryName}</span>
                                </div>
                                <div className="text-right">
                                  <span className={`font-bold text-xl px-4 py-2 rounded-full ${
                                    isIncome 
                                      ? `text-green-600 ${isDarkMode ? 'bg-green-900/30' : 'bg-green-100'}` 
                                      : `text-red-600 ${isDarkMode ? 'bg-red-900/30' : 'bg-red-100'}`
                                  }`}>
                                    Rp {category.total?.toLocaleString() || '0'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📊</div>
                  <p className={`text-xl font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading categories...</p>
                </div>
              )}

              {/* Recent transactions section */}
              <div className="mt-12">
                <h3 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                  <span className="text-3xl">⚡</span>
                  Recent Transactions
                </h3>
                {summaryData?.expensesOverTime && summaryData.expensesOverTime.length > 0 ? (
                  <div className="space-y-6">
                    {summaryData.expensesOverTime.slice(0, 5).map((expense, index) => {
                      const isExpanded = expandedTransactions[expense.date] || false;
                      const transactionCount = expense.transactions?.length || 0;
                      
                      return (
                        <div key={index} className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl p-6 shadow-lg border transition-all duration-300 hover:shadow-xl cursor-pointer transform hover:scale-[1.01]`}
                             onClick={() => setExpandedTransactions(prev => ({ ...prev, [expense.date]: !prev[expense.date] }))}>
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-4">
                              <div className={`${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'} text-white p-3 rounded-xl`}>
                                <span className="text-xl">📅</span>
                              </div>
                              <div>
                                <span className="font-medium text-xl">{expense.date}</span>
                                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} flex items-center gap-2`}>
                                  <span className={`${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'} px-3 py-1 rounded-full font-medium`}>
                                    {transactionCount} transaction{transactionCount !== 1 ? 's' : ''}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="font-semibold text-xl">
                                  Rp {expense.total.toLocaleString()}
                                </p>
                                <div className="flex gap-2 text-sm">
                                  {expense.income > 0 && (
                                    <span className={`${isDarkMode ? 'text-green-400' : 'text-green-600'} font-medium`}>
                                      +{expense.income.toLocaleString()}
                                    </span>
                                  )}
                                  {expense.expense > 0 && (
                                    <span className={`${isDarkMode ? 'text-red-400' : 'text-red-500'} font-medium`}>
                                      -{expense.expense.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className={`p-2 rounded-full transition-all duration-300 ${isExpanded ? `${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'} rotate-180` : `${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}`}>
                                <svg
                                  className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
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
                            </div>
                          </div>
                          
                          {/* Expanded details */}
                          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 mt-6' : 'max-h-0'}`}>
                            {expense.transactions && expense.transactions.length > 0 ? (
                              <div className={`space-y-3 pl-6 border-l-4 ${isDarkMode ? 'border-blue-600' : 'border-blue-500'}`}>
                                {expense.transactions.map((transaction, detailIndex) => {
                                  const isEditing = editingTransaction === (transaction.id || transaction._id);
                                  
                                  return (
                                    <div key={detailIndex} className={`${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-xl p-4 transition-all duration-300 hover:shadow-lg transform hover:scale-[1.01]`}>
                                      {isEditing ? (
                                        // Edit form
                                        <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                                          <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>📝 Type</label>
                                            <select
                                              value={editFormData.type}
                                              onChange={(e) => setEditFormData(prev => ({ ...prev, type: e.target.value }))}
                                              onClick={(e) => e.stopPropagation()}
                                              className={`w-full px-4 py-3 rounded-xl border-2 ${isDarkMode ? 'bg-gray-800 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'} focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
                                            >
                                              <option value="expense">💸 Expense</option>
                                              <option value="income">💰 Income</option>
                                              <option value="transfer">🔄 Transfer</option>
                                            </select>
                                          </div>
                                          <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>✏️ Description</label>
                                            <input
                                              type="text"
                                              value={editFormData.name}
                                              onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                                              onClick={(e) => e.stopPropagation()}
                                              className={`w-full px-4 py-3 rounded-xl border-2 ${isDarkMode ? 'bg-gray-800 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'} focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
                                            />
                                          </div>
                                          <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>💰 Amount</label>
                                            <input
                                              type="number"
                                              value={editFormData.price}
                                              onChange={(e) => setEditFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                                              onClick={(e) => e.stopPropagation()}
                                              className={`w-full px-4 py-3 rounded-xl border-2 ${isDarkMode ? 'bg-gray-800 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'} focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
                                            />
                                          </div>
                                          <div className="flex gap-3">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                handleSaveEdit().catch(err => {
                                                  console.error('Unhandled error in save:', err);
                                                  setError(`Save failed: ${err.message || 'Unknown error'}`);
                                                  setIsLoading(false);
                                                });
                                              }}
                                              disabled={isLoading}
                                              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl font-medium transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
                                            >
                                              {isLoading ? (
                                                <span className="flex items-center gap-2">
                                                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                  </svg>
                                                  Saving...
                                                </span>
                                              ) : (
                                                '✅ Save'
                                              )}
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                setEditingTransaction(null);
                                                setError(null);
                                              }}
                                              disabled={isLoading}
                                              className="px-6 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white rounded-xl font-medium transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
                                            >
                                              ❌ Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        // Display mode
                                        <div className="flex justify-between items-start">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                              <span className="text-2xl">{getCategoryEmoji(transaction.category || '')}</span>
                                              <p className="font-medium text-lg">{transaction.category || 'Uncategorized'}</p>
                                            </div>
                                            <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-1`}>{transaction.description || 'No description'}</p>
                                            <div className="flex items-center gap-2">
                                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                transaction.type.toLowerCase() === 'expense' ? `${isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600'}` :
                                                transaction.type.toLowerCase() === 'income' ? `${isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-600'}` :
                                                `${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'}`
                                              }`}>
                                                {transaction.type.toUpperCase()}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-4">
                                            <div className="text-right">
                                              <p className={`font-semibold text-xl ${
                                                transaction.type.toLowerCase() === 'expense' || transaction.type.toLowerCase() === 'transfer' 
                                                  ? `${isDarkMode ? 'text-red-400' : 'text-red-500'}` 
                                                  : transaction.type.toLowerCase() === 'income' 
                                                    ? `${isDarkMode ? 'text-green-400' : 'text-green-500'}` 
                                                    : ''
                                              }`}>
                                                Rp {transaction.amount ? transaction.amount.toLocaleString() : '0'}
                                              </p>
                                              <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} font-medium`}>{transaction.time}</p>
                                            </div>
                                            {/* Action buttons */}
                                            <div className="flex gap-2 ml-3">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleEditTransaction(transaction);
                                                }}
                                                className={`p-2 text-blue-500 hover:text-blue-700 ${isDarkMode ? 'hover:bg-blue-900/30' : 'hover:bg-blue-100'} rounded-xl transition-all duration-300 transform hover:scale-110`}
                                                title="Edit transaction"
                                              >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const transactionId = transaction._id || transaction.id;
                                                  if (transactionId) {
                                                    handleDeleteTransaction(transactionId);
                                                  } else {
                                                    console.error('No transaction ID found');
                                                    setError('Transaction ID not found');
                                                  }
                                                }}
                                                disabled={isLoading}
                                                className={`p-2 text-red-500 hover:text-red-700 ${isDarkMode ? 'hover:bg-red-900/30' : 'hover:bg-red-100'} rounded-xl transition-all duration-300 transform hover:scale-110 disabled:opacity-50`}
                                                title="Delete transaction"
                                              >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <div className="text-4xl mb-2">📝</div>
                                <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`}>No transactions available for this day.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">⚡</div>
                    <p className={`text-xl font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No recent expenses found.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'accounts' && (
            <div>
              <h3 className="text-xl font-semibold mb-4">Account Statistics</h3>
              {summaryData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{percentage}%</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

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
                <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading account statistics...</p>
              )}
            </div>
          )}

          {activeTab === 'charts' && (
            <div>
              <h3 className="text-xl font-semibold mb-4">Expense Breakdown</h3>
              {summaryData?.expensesOverTime ? (
                <div className={`p-4 rounded-lg shadow-sm border ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                  <ExpensesChart data={summaryData.expensesOverTime} />
                </div>
              ) : (
                <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading chart...</p>
              )}
            </div>
          )}
        </div>

        {/* Theme toggle button */}
        <div className="mt-12 text-center">
          <button
            onClick={toggleTheme}
            className={`px-8 py-4 ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-xl flex items-center mx-auto gap-3 justify-center font-medium text-lg`}
          >
            {isDarkMode ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                <span>☀️ Light Mode</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
                <span>🌙 Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;