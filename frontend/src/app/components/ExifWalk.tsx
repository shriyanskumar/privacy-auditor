import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import worldData from "../../data/world.json";
import { Globe, Search } from "lucide-react";

interface ExifWalkProps {
  sessionId: string | null;
}

export default function ExifWalk({ sessionId }: ExifWalkProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const [locations, setLocations] = useState<any[]>([]);
  const [worldView, setWorldView] = useState(false);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    location: any | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    location: null,
  });
  const photosScanned = locations.length;

  const gpsTagged = locations.filter(
    (loc) => loc.lat !== null && loc.lon !== null,
  ).length;

  const devicesFound = new Set(
    locations.map((loc) => loc.device_model || loc.device || "Unknown Device"),
  ).size;
  const deviceStats = Object.entries(
    locations.reduce((acc: Record<string, number>, loc: any) => {
      const device = loc.device_model || loc.device || "Unknown Device";

      acc[device] = (acc[device] || 0) + 1;

      return acc;
    }, {}),
  ) as [string, number][];
  const uniqueCountries = new Set(
    locations.map((loc) => loc.country).filter(Boolean),
  ).size;

  const riskScore = Math.min(
    100,
    gpsTagged * 5 + devicesFound * 10 + uniqueCountries * 8,
  );
  // Fetch EXIF data
  useEffect(() => {
    if (!sessionId) return;

    const fetchExifData = async () => {
      try {
        const response = await fetch(
          `http://localhost:3001/api/exif/${sessionId}`,
        );

        const data = await response.json();

        if (data.locations) {
          const validLocations = data.locations.filter(
            (loc: any) => loc.lat !== null && loc.lon !== null,
          );
          setLocations(validLocations);
        }
      } catch (error) {
        console.error("Failed to fetch EXIF data:", error);
      }
    };

    fetchExifData();
  }, [sessionId]);

  // Draw map + markers
  useEffect(() => {
    const svg = d3.select(svgRef.current);

    svg.selectAll("*").remove();
    const mapGroup = svg.append("g");
    const markerLayer = svg.append("g");
    const width = 1200;
    const height = 700;

    mapGroup
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("background", "#0A0A0A");

    const countries = feature(
      worldData as any,
      (worldData as any).objects.countries,
    );

    let projection;

    if (!worldView && locations.length > 1) {
      const geoPoints = {
        type: "FeatureCollection",
        features: locations.map((loc) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [Number(loc.lon), Number(loc.lat)],
          },
        })),
      };

      projection = d3.geoNaturalEarth1().fitExtent(
        [
          [220, 180],
          [width - 220, height - 180],
        ],
        geoPoints as any,
      );
    } else {
      projection = d3
        .geoNaturalEarth1()
        .fitSize([width, height], countries as any);
    }
    const path = d3.geoPath().projection(projection);
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 40])
      .on("zoom", (event: any) => {
        mapGroup.attr("transform", event.transform);
        mapGroup
          .selectAll(".connection-line")
          .attr("stroke-width", 1.5 / event.transform.k)
          .attr(
            "stroke-dasharray",
            `${4 / event.transform.k} ${4 / event.transform.k}`,
          );
        markerLayer
          .selectAll<SVGGElement, unknown>("g")
          .attr("transform", function (this: SVGGElement) {
            const marker = d3.select(this);

            const x = Number(marker.attr("data-x"));
            const y = Number(marker.attr("data-y"));

            return `translate(
      ${event.transform.applyX(x)},
      ${event.transform.applyY(y)}
    )`;
          });
      });

    const graticule = d3.geoGraticule();

    // Grid
    mapGroup
      .append("path")
      .datum(graticule())
      .attr("d", path as any)
      .attr("fill", "none")
      .attr("stroke", "rgba(255,107,0,0.08)")
      .attr("stroke-width", 0.5);

    // Countries
    mapGroup
      .append("g")
      .selectAll("path")
      .data((countries as any).features)
      .enter()
      .append("path")
      .attr("d", path as any)
      .attr("fill", "#141414")
      .attr("stroke", "#444")
      .attr("stroke-width", 0.5);
    // Connection Lines

    for (let i = 0; i < locations.length - 1; i++) {
      const start = projection([
        Number(locations[i].lon),
        Number(locations[i].lat),
      ]);

      const end = projection([
        Number(locations[i + 1].lon),
        Number(locations[i + 1].lat),
      ]);

      if (!start || !end) continue;

      mapGroup
        .append("line")
        .attr("class", "connection-line")
        .attr("x1", start[0])
        .attr("y1", start[1])
        .attr("x2", end[0])
        .attr("y2", end[1])
        .attr("stroke", "rgba(255,107,0,0.18)")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "4 4");
    }
    // GPS Markers
    locations.forEach((location) => {
      const point = projection([Number(location.lon), Number(location.lat)]);

      if (!point) return;

      const [x, y] = point;

      const markerGroup = markerLayer
        .append("g")
        .attr("data-x", x)
        .attr("data-y", y)
        .attr("transform", `translate(${x}, ${y})`);
      for (let i = 0; i < 3; i++) {
        const pulse = markerGroup
          .append("circle")
          .attr("cx", 0)
          .attr("cy", 0)
          .attr("r", 8)
          .attr("fill", "none")
          .attr("stroke", "#FF6B00")
          .attr("stroke-width", 0.8)
          .attr("opacity", 0);

        const animate = () => {
          pulse
            .attr("r", 8)
            .attr("opacity", 0.5)
            .transition()
            .delay(i * 600)
            .duration(2000)
            .ease(d3.easeLinear)
            .attr("r", 40)
            .attr("opacity", 0)
            .on("end", animate);
        };

        animate();
      }

      markerGroup
        .append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 12)
        .attr("fill", "rgba(255,107,0,0.15)");

      markerGroup
        .append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 6)
        .attr("fill", "none")
        .attr("stroke", "rgba(255,107,0,0.7)")
        .attr("stroke-width", 2);

      markerGroup
        .append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 3)
        .attr("fill", "#FF6B00");

      markerGroup
        .append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 15)
        .attr("fill", "transparent")
        .style("cursor", "pointer")
        .on("mouseenter", (event: any) => {
          setTooltip({
            visible: true,
            x: event.clientX + 16,
            y: event.clientY - 20,
            location,
          });
        })
        .on("mousemove", (event: any) => {
          setTooltip((prev) => ({
            ...prev,
            x: event.clientX + 16,
            y: event.clientY - 20,
          }));
        })
        .on("mouseleave", () => {
          setTooltip({
            visible: false,
            x: 0,
            y: 0,
            location: null,
          });
        });
    });
    svg.call(zoom as any);
  }, [locations, worldView]);

  return (
    <div
      style={{
        width: "100%",
        background: "#0A0A0A",
        border: "1px solid #FF6B00",
        borderRadius: "16px",
        padding: "24px",
      }}
    >
      <h1
        style={{
          color: "white",
          fontSize: "32px",
          fontWeight: "bold",
          marginBottom: "24px",
        }}
      >
        EXIF WALK
      </h1>
      <div
        style={{
          marginBottom: "20px",
          padding: "16px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,107,0,0.12)",
          borderRadius: "12px",
          color: "#BBB",
          fontSize: "14px",
        }}
      >
        {gpsTagged > 0 ? (
          <>
            This device contains <b>{gpsTagged}</b> GPS-tagged images from{" "}
            <b>{gpsTagged}</b> recorded locations and
            <b> {devicesFound}</b> devices.
          </>
        ) : (
          <>No GPS-tagged images detected.</>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.7fr 1fr",
          gap: "24px",
          marginTop: "20px",
          marginBottom: "20px",
        }}
      >
        {/* LEFT COLUMN */}
        <div>
          <div
            style={{
              position: "relative",
              border: "1px solid rgba(255,107,0,0.15)",
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "16px",
                left: "16px",
                zIndex: 1000,
                display: "flex",
                gap: "10px",
              }}
            >
              <button
                onClick={() => setWorldView(false)}
                style={{
                  padding: "10px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,107,0,0.2)",
                  background: !worldView
                    ? "rgba(255,107,0,0.15)"
                    : "rgba(255,255,255,0.03)",
                  color: "#FF6B00",
                  cursor: "pointer",
                }}
              >
                <Search size={18} />
              </button>

              <button
                onClick={() => setWorldView(true)}
                style={{
                  padding: "10px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,107,0,0.2)",
                  background: worldView
                    ? "rgba(255,107,0,0.15)"
                    : "rgba(255,255,255,0.03)",
                  color: "#FF6B00",
                  cursor: "pointer",
                }}
              >
                <Globe size={18} />
              </button>
            </div>

            <svg
              ref={svgRef}
              width="100%"
              height="700"
              style={{
                display: "block",
                background: "#050505",
              }}
            />
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            {[
              ["Photos Scanned", photosScanned],
              ["GPS Tagged", gpsTagged],
              ["Devices Found", devicesFound],
              ["Risk Score", riskScore],
            ].map(([title, value]) => (
              <div
                key={title}
                style={{
                  background: "rgba(255,107,0,0.05)",
                  border: "1px solid rgba(255,107,0,0.15)",
                  borderRadius: "12px",
                  padding: "18px",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    color: "#888",
                    textTransform: "uppercase",
                    marginBottom: "8px",
                  }}
                >
                  {title}
                </div>

                <div
                  style={{
                    fontSize: "36px",
                    fontWeight: "bold",
                    color:
                      title === "Risk Score" && riskScore > 70
                        ? "#FF4444"
                        : "#FFF",
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,107,0,0.15)",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                color: "#FFF",
                fontWeight: 700,
                marginBottom: "12px",
              }}
            >
              KEY FINDINGS
            </div>

            <div style={{ color: "#BBB", lineHeight: 2 }}>
              <div>• {gpsTagged} GPS-tagged photos discovered</div>
              <div>• {devicesFound} devices contain location metadata</div>
              <div>• Historical movement patterns may be reconstructed</div>
              <div>• High privacy exposure risk identified</div>
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,107,0,0.15)",
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <div
              style={{
                color: "#FFF",
                fontWeight: 700,
                marginBottom: "16px",
              }}
            >
              DEVICE BREAKDOWN
            </div>

            {deviceStats.map(([device, count]) => (
              <div
                key={device}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  color: "#DDD",
                }}
              >
                <span>{device}</span>
                <span>{count} photos</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: "16px",
          borderTop: "1px solid rgba(255,107,0,0.15)",
          paddingTop: "12px",
          display: "flex",
          alignItems: "center",
          gap: "24px",
          fontSize: "12px",
          fontFamily: "monospace",
          color: "#888",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            color: "#FF6B00",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#FF6B00",
              display: "inline-block",
              boxShadow: "0 0 8px #FF6B00",
            }}
          />
          SCANNING
        </div>

        <div>LOCATIONS: {gpsTagged}</div>

        <div>DEVICES: {devicesFound}</div>

        <div
          style={{
            marginLeft: "auto",
            color: "#666",
          }}
        >
          EXIF v2.3
        </div>
      </div>
    </div>
  );
}
