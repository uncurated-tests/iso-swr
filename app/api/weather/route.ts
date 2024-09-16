export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    location: {
      name: "San Francisco",
      region: "CA",
      country: "USA",
      tz_id: "America/Los_Angeles",
      localtime_epoch: new Date().getTime() / 1000,
    },
    current: {
      temp_f: (50 + Math.random() * 30).toFixed(0),
      condition: {
        text: ["Sunny", "Cloudy", "Rainy"][Math.floor(Math.random() * 3)],
      },
    },
  });
}
