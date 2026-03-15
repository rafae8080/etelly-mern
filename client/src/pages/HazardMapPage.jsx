export default function HazardMapPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Hazard Map</h1>

      <div className="flex gap-4">
        {/* Zoom Controls */}
        <div className="flex flex-col gap-2">
          <button className="w-10 h-10 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center text-gray-700 font-semibold text-xl shadow-sm">
            +
          </button>
          <button className="w-10 h-10 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center text-gray-700 font-semibold text-xl shadow-sm">
            −
          </button>
        </div>

        {/* Map */}
        <div
          className="flex-1 relative bg-gray-300 rounded-xl overflow-hidden"
          style={{ height: "500px" }}
        >
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d25447.630494827325!2d120.90371949757723!3d14.692432804232856!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397b499f04aaccd%3A0x1d5152fd176eb12a!2sTanza%201%2C%20Navotas%2C%20Metro%20Manila!5e1!3m2!1sen!2sph!4v1769610391992!5m2!1sen!2sph"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen={true}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0"
          />

          {/* Legend */}
          <div className="fixed bottom-6 right-6 bg-white rounded-lg p-4 shadow-lg z-10 w-50">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Severity Level
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-red-700 rounded" />
                <span className="text-sm text-gray-700">High</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-orange-500 rounded" />
                <span className="text-sm text-gray-700">Medium</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-green-700 rounded" />
                <span className="text-sm text-gray-700">Low</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
