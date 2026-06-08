const IconButton = ({ icon: Icon, label, onClick, variant = "idle", size = 52 }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className={`icon-button icon-button--${variant}`}
    style={{ width: size, height: size }}
  >
    {Icon && <Icon size={Math.round(size * 0.42)} strokeWidth={1.8} />}
  </button>
);

export default IconButton;
