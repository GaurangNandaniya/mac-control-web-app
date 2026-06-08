const Tile = ({ icon: Icon, label, onClick, active = false, accentText }) => (
  <button
    type="button"
    onClick={onClick}
    className={`tile ${active ? "tile--active" : ""}`}
  >
    {Icon && <Icon size={20} strokeWidth={1.8} />}
    {label && <span className="tile-label">{label}</span>}
    {accentText && <span className="tile-accent-text">{accentText}</span>}
  </button>
);

export default Tile;
