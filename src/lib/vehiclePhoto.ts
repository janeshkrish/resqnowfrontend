/** The app's studio picture of a car or a bike: what every saved vehicle is shown with. */
export const studioImage = (type?: string | null) =>
  type === "bike" ? "/images/vehicles/bike.webp" : "/images/vehicles/car.webp";
