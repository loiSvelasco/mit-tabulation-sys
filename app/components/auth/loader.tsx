import React from "react";

const FullPageLoader: React.FC = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-80 z-50">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-gray-900 border-solid"></div>
    </div>
  );
};

export default FullPageLoader;
