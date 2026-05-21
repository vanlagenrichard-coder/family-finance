import { Link } from "react-router-dom";

function Home() {
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1 style={styles.title}>Family Finance</h1>
        <p style={styles.subtitle}>History is the source of truth.</p>

        <nav style={styles.nav}>
          <Link to="/history" style={styles.button}>
            History
          </Link>

          <Link to="/balances" style={styles.button}>
            Balances
          </Link>

          <Link to="/setup" style={styles.button}>
            Setup
          </Link>
        </nav>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f6f8",
    padding: "20px",
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: "520px",
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: "18px",
    padding: "22px",
    boxSizing: "border-box",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.08)",
  },
  title: {
    margin: "0 0 8px",
    fontSize: "30px",
    color: "#111827",
  },
  subtitle: {
    margin: "0 0 24px",
    fontSize: "16px",
    color: "#6b7280",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  button: {
    display: "block",
    textDecoration: "none",
    textAlign: "center",
    background: "#111827",
    color: "#ffffff",
    borderRadius: "14px",
    padding: "20px",
    fontSize: "22px",
    fontWeight: "700",
  },
};

export default Home;