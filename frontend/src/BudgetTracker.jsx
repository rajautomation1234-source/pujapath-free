import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "pujapath_budget_tracker";

const defaultData = {
  budget: 5000,
  expenses: [],
};

function BudgetTracker({ onClose }) {
  const [budget, setBudget] = useState(defaultData.budget);
  const [expenses, setExpenses] = useState(defaultData.expenses);

  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Food");

  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);

      if (savedData) {
        const parsedData = JSON.parse(savedData);

        setBudget(
          typeof parsedData.budget === "number"
            ? parsedData.budget
            : defaultData.budget
        );

        setExpenses(
          Array.isArray(parsedData.expenses)
            ? parsedData.expenses
            : []
        );
      }
    } catch (error) {
      console.error("Failed to load budget data:", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        budget,
        expenses,
      })
    );
  }, [budget, expenses]);

  const totalSpent = useMemo(() => {
    return expenses.reduce((total, expense) => {
      return total + expense.amount;
    }, 0);
  }, [expenses]);

  const remaining = budget - totalSpent;

  const spentPercentage =
    budget > 0
      ? Math.min((totalSpent / budget) * 100, 100)
      : 0;

  const addExpense = (event) => {
    event.preventDefault();

    const name = expenseName.trim();
    const amount = Number(expenseAmount);

    if (!name) {
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const newExpense = {
      id: Date.now(),
      name,
      amount,
      category: expenseCategory,
    };

    setExpenses((previousExpenses) => [
      ...previousExpenses,
      newExpense,
    ]);

    setExpenseName("");
    setExpenseAmount("");
    setExpenseCategory("Food");
  };

  const deleteExpense = (id) => {
    setExpenses((previousExpenses) =>
      previousExpenses.filter((expense) => expense.id !== id)
    );
  };

  return (
    <div className="budget-overlay">
      <div className="budget-card">
        <div className="budget-header">
          <div>
            <h2>💰 Puja Budget Tracker</h2>
            <p>Track your Puja spending easily</p>
          </div>

          <button
            type="button"
            className="budget-close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="budget-summary">
          <div className="budget-box">
            <span>Total Budget</span>
            <strong>₹{budget.toFixed(2)}</strong>
          </div>

          <div className="budget-box">
            <span>Spent</span>
            <strong>₹{totalSpent.toFixed(2)}</strong>
          </div>

          <div className="budget-box">
            <span>Remaining</span>
            <strong className={remaining < 0 ? "over-budget" : ""}>
              ₹{remaining.toFixed(2)}
            </strong>
          </div>
        </div>

        <div className="budget-progress-section">
          <div className="budget-progress-top">
            <span>Budget Used</span>
            <span>{spentPercentage.toFixed(0)}%</span>
          </div>

          <div className="budget-progress">
            <div
              className="budget-progress-fill"
              style={{ width: `${spentPercentage}%` }}
            ></div>
          </div>
        </div>

        <div className="budget-setting">
          <label htmlFor="puja-budget">
            Set Your Budget
          </label>

          <input
            id="puja-budget"
            type="number"
            min="0"
            step="100"
            value={budget}
            onChange={(event) => {
              const value = Number(event.target.value);

              if (Number.isFinite(value) && value >= 0) {
                setBudget(value);
              }
            }}
          />
        </div>

        <form
          className="budget-expense-form"
          onSubmit={addExpense}
        >
          <h3>➕ Add Expense</h3>

          <input
            type="text"
            placeholder="Expense name"
            value={expenseName}
            onChange={(event) =>
              setExpenseName(event.target.value)
            }
          />

          <input
            type="number"
            min="0"
            step="1"
            placeholder="Amount ₹"
            value={expenseAmount}
            onChange={(event) =>
              setExpenseAmount(event.target.value)
            }
          />

          <select
            value={expenseCategory}
            onChange={(event) =>
              setExpenseCategory(event.target.value)
            }
          >
            <option value="Food">🍔 Food</option>
            <option value="Transport">🚕 Transport</option>
            <option value="Shopping">🛍️ Shopping</option>
            <option value="Puja">🪔 Puja</option>
            <option value="Tickets">🎟️ Tickets</option>
            <option value="Other">📦 Other</option>
          </select>

          <button type="submit">
            Add Expense
          </button>
        </form>

        <div className="budget-expenses">
          <h3>📋 Expenses</h3>

          {expenses.length === 0 ? (
            <div className="budget-empty">
              No expenses added yet.
            </div>
          ) : (
            expenses.map((expense) => (
              <div
                className="budget-expense-row"
                key={expense.id}
              >
                <div>
                  <strong>{expense.name}</strong>
                  <small>{expense.category}</small>
                </div>

                <div className="budget-expense-right">
                  <strong>
                    ₹{expense.amount.toFixed(2)}
                  </strong>

                  <button
                    type="button"
                    onClick={() =>
                      deleteExpense(expense.id)
                    }
                    aria-label={`Delete ${expense.name}`}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default BudgetTracker;