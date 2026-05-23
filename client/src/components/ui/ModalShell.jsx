const SIZE = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl" };

export default function ModalShell({ onClose, size = "md", flex = false, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${SIZE[size]} max-h-[90vh]
                    ${flex ? "flex flex-col overflow-hidden" : "overflow-y-auto"}`}
      >
        {children}
      </div>
    </div>
  );
}
