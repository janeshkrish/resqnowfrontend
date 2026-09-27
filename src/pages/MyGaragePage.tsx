import { useLocation, useNavigate } from "react-router-dom";
import MyGarage from "@/components/MyGarage";

/** The customer's garage: the same vehicles as Settings → My Garage. /my-garage/add opens the add steps. */
const MyGaragePage = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const startAdding = pathname.replace(/\/+$/, "").endsWith("/add");

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  return (
    <div className="rqg-page">
      <MyGarage
        startAdding={startAdding}
        onBack={goBack}
        onAddClosed={() => {
          if (startAdding) navigate("/my-garage", { replace: true });
        }}
      />
    </div>
  );
};

export default MyGaragePage;
