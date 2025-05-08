const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

interface JwtPayload {
  sub: string;
  exp: number;
}

export const extractPhoneNumber = (token: string): string => {
  console.log('Received token:', token);
  console.log(typeof token);
  console.log(token.split('.').length);

  try {
    if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
      throw new Error('Invalid token format');
    }

    const base64Payload = token.split('.')[1];
    const base64 = base64Payload.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const paddedBase64 = base64 + padding;

    const decodedPayload = atob(paddedBase64);
    const payload = JSON.parse(decodedPayload) as JwtPayload;

    if (typeof payload?.sub !== 'string' || !payload.sub.trim()) {
      throw new Error('Missing or invalid "sub" field in token payload');
    }

    return payload.sub;
  } catch (error) {
    console.error('Error decoding JWT token:', error);
    throw new Error('Invalid token');
  }
};

interface DailyTransaction {
  type: string;
  amount: string | number;
}

interface DailyStat {
  transactions: DailyTransaction[];
}

export const calculateSummaryFromDaily = (dailyStats: DailyStat[]) => {
  const summary = dailyStats.reduce((acc, day) => {
    day.transactions.forEach((tx: DailyTransaction) => {
      const amount = parseFloat(String(tx.amount)) || 0;
      switch (tx.type.toLowerCase()) {
        case 'expense':
          acc.totalExpenses += amount;
          break;
        case 'income':
          acc.totalIncome += amount;
          break;
        case 'transfer':
          acc.totalTransfer += amount;
          break;
      }
    });
    return acc;
  }, { totalExpenses: 0, totalIncome: 0, totalTransfer: 0 });

  return summary;
};

export const fetchDailyExpenses = async (token: string, month: number, year: number) => {
  const phoneNumber = extractPhoneNumber(token);
  try {
    console.log('\n[API Request] Fetching daily expenses:', { phoneNumber, month, year });
    const response = await fetch(`${API_URL}/stats/daily?phone_number=${phoneNumber}&month=${month}&year=${year}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error('\n[API Error] Failed to fetch daily expenses:', response.status);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('\n[API Response] Daily expenses data:', JSON.stringify(data, null, 2));

  if (!Array.isArray(data.daily_stats)) {
    console.error('[Data Error] Invalid daily_stats format:', data);
    return [];
  }

  return data.daily_stats.map((item: {
    total: number;
    transaction_count: number;
    transactions: Array<{
      _id: string;
      amount: number;
      type: string;
      category: string | null;
      time: string;
      image_url: string;
      description: string;
    }>;
    date: string;
  }) => ({
    date: item.date,
    total: parseFloat(String(item.total)) || 0,
    transactionCount: item.transaction_count,
    transactions: item.transactions.map(t => ({
      id: t._id,
      amount: parseFloat(String(t.amount)) || 0,
      type: t.type,
      category: t.category || 'Uncategorized',
      time: t.time,
      imageUrl: t.image_url?.trim(),
      description: t.description,
    })),

  }));
  } catch (error) {
    console.error('\n[Error] Failed to fetch daily expenses:', error);
    throw error;
  }
};

interface CategoryTransaction {
  category: string | null;
  amount: string | number;
  type: string;
}

interface DailyStatWithTransactions {
  transactions: CategoryTransaction[];
}

export const calculateExpensesByCategory = (dailyStats: DailyStatWithTransactions[]) => {
  const categoryMap = new Map<string, { type: string; total: number }>();

  dailyStats.forEach(day => {
    day.transactions.forEach((tx: CategoryTransaction) => {
      const category = tx.category || 'Uncategorized';
      const amount = parseFloat(String(tx.amount)) || 0;
      const type = tx.type.toLowerCase();

      const key = `${category}-${type}`;
      if (!categoryMap.has(key)) {
        categoryMap.set(key, { type, total: 0 });
      }
      const current = categoryMap.get(key)!;
      current.total += amount;
    });
  });

  return Array.from(categoryMap.entries()).map(([key, value]) => ({
    _id: key.split('-')[0],
    type: value.type,
    total: value.total
  }));
};
