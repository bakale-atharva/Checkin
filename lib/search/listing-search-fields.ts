export function listingSearchFields(location: {
  city: string;
  countryCode: string;
}) {
  return {
    searchCity: location.city.trim().toLocaleLowerCase("en-US"),
    searchCountryCode: location.countryCode.trim().toUpperCase(),
  };
}
