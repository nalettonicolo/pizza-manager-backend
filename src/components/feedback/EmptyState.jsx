export default function EmptyState({ message = "Nessun dato disponibile." }) {
  return (
    <div style={styles.wrapper}>
      <p>{message}</p>
    </div>
  )
}

const styles = {
  wrapper: {
    padding: "40px",
    textAlign: "center",
    opacity: 0.6,
  },
}
