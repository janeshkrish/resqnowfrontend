import { useLocation } from "react-router-dom";
import MyGarage from "@/components/MyGarage";

/** The customer's garage: the same vehicles as Settings → My Garage. /my-garage/add opens the add steps. */
const MyGaragePage = () => {
  const { pathname } = useLocation();
  const startAdding = pathname.replace(/\/+$/, "").endsWith("/add");
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
      <MyGarage key={pathname} startAdding={startAdding} />
    </div>
  );
};

export default MyGaragePage;
