
import React from "react";

type PageHeaderProps = {
  title: string;
  description: string;
};

const PageHeader = ({ title, description }: PageHeaderProps) => {
  return (
    <div className="bg-gradient-to-r from-primary to-blue-700 text-white py-16">
      <div className="container">
        <h1 className="text-4xl md:text-5xl font-bold text-center">{title}</h1>
        <p className="text-xl text-center mt-4 max-w-3xl mx-auto">
          {description}
        </p>
      </div>
    </div>
  );
};

export default PageHeader;
