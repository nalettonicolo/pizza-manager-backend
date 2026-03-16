export default function Loader({ message = "Caricamento..." }) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.spinner} />
      <p>{message}</p>
    </div>
  )
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px",
    gap: "16px",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #eee",
    borderTop: "4px solid #333",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
}
