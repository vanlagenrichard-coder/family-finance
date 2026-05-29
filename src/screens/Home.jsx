import { Link } from "react-router-dom";

function Home() {
  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroTop}>
          <p style={styles.eyebrow}>
            FAMILY FINANCE
          </p>

          <h1 style={styles.title}>
            Your money.
            <br />
            Fully organized.
          </h1>

          <p style={styles.subtitle}>
            Track every dollar with
            paycheck splitting, live
            balances, sinking funds,
            and transaction history.
          </p>
        </div>

        <div style={styles.cardGrid}>
          <Link
            to="/history"
            style={styles.bigButton}
          >
            <div>
              <span style={styles.buttonLabel}>
                Transactions
              </span>

              <strong
                style={styles.buttonTitle}
              >
                History
              </strong>
            </div>

            <span style={styles.arrow}>
              →
            </span>
          </Link>

          <Link
            to="/balances"
            style={styles.bigButton}
          >
            <div>
              <span style={styles.buttonLabel}>
                Budget Tracking
              </span>

              <strong
                style={styles.buttonTitle}
              >
                Balances
              </strong>
            </div>

            <span style={styles.arrow}>
              →
            </span>
          </Link>

          <Link
            to="/setup"
            style={styles.bigButton}
          >
            <div>
              <span style={styles.buttonLabel}>
                Buckets & Rules
              </span>

              <strong
                style={styles.buttonTitle}
              >
                Setup
              </strong>
            </div>

            <span style={styles.arrow}>
              →
            </span>
          </Link>
        </div>

        <section style={styles.infoCard}>
          <h2 style={styles.infoTitle}>
            How it works
          </h2>

          <div style={styles.infoList}>
            <div style={styles.infoItem}>
              <span style={styles.infoNumber}>
                1
              </span>

              <p>
                Add your paycheck in
                History.
              </p>
            </div>

            <div style={styles.infoItem}>
              <span style={styles.infoNumber}>
                2
              </span>

              <p>
                Your money auto-splits
                into buckets.
              </p>
            </div>

            <div style={styles.infoItem}>
              <span style={styles.infoNumber}>
                3
              </span>

              <p>
                Track balances and
                spending live.
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
    padding: "20px",
    boxSizing: "border-box",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  hero: {
    width: "100%",
    maxWidth: "680px",
    margin: "0 auto",
  },

  heroTop: {
    marginBottom: "24px",
  },

  eyebrow: {
    margin: "0 0 10px",
    fontSize: "12px",
    fontWeight: "900",
    letterSpacing: "0.12em",
    color: "#6366f1",
  },

  title: {
    margin: "0",
    fontSize: "52px",
    lineHeight: "0.95",
    fontWeight: "950",
    letterSpacing: "-2px",
    color: "#0f172a",
  },

  subtitle: {
    margin: "18px 0 0",
    fontSize: "18px",
    lineHeight: "1.5",
    color: "#475569",
    maxWidth: "540px",
    fontWeight: "600",
  },

  cardGrid: {
    display: "grid",
    gap: "16px",
    marginTop: "28px",
  },

  bigButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    textDecoration: "none",
    background: "#ffffff",
    borderRadius: "28px",
    padding: "24px",
    boxShadow:
      "0 14px 30px rgba(15, 23, 42, 0.08)",
    border:
      "1px solid rgba(15, 23, 42, 0.06)",
    transition: "0.2s ease",
  },

  buttonLabel: {
    display: "block",
    fontSize: "13px",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#64748b",
    marginBottom: "6px",
  },

  buttonTitle: {
    display: "block",
    fontSize: "32px",
    lineHeight: "1",
    color: "#111827",
    fontWeight: "950",
    letterSpacing: "-1px",
  },

  arrow: {
    fontSize: "34px",
    fontWeight: "700",
    color: "#6366f1",
  },

  infoCard: {
    marginTop: "28px",
    background: "#111827",
    color: "#ffffff",
    borderRadius: "28px",
    padding: "24px",
    boxShadow:
      "0 18px 34px rgba(15, 23, 42, 0.18)",
  },

  infoTitle: {
    margin: "0 0 18px",
    fontSize: "26px",
    fontWeight: "950",
    letterSpacing: "-0.8px",
  },

  infoList: {
    display: "grid",
    gap: "14px",
  },

  infoItem: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    background: "rgba(255,255,255,0.06)",
    borderRadius: "18px",
    padding: "14px",
  },

  infoNumber: {
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    background: "#6366f1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "900",
    flexShrink: 0,
  },

  "@media (max-width: 520px)": {},

  infoItemText: {
    margin: 0,
  },
};

export default Home;