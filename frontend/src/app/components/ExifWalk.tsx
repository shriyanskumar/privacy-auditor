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

        console.log("EXIF API RESPONSE:", data);

        if (data.locations) {
          const validLocations = data.locations.filter(
            (loc: any) => loc.lat !== null && loc.lon !== null,
          );

          setLocations(validLocations);

          console.log("Valid GPS Locations:", validLocations.length);
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

      {/* MAP SECTION */}

      <div
        style={{
          position: "relative",
          marginBottom: "32px",
          marginTop: "12px",
        }}
      >
        {/* Controls */}
        <div
          style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            zIndex: 1000,
            display: "flex",
            gap: "10px",
            pointerEvents: "auto",
          }}
        >
          <button
            onClick={() => setWorldView(false)}
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              cursor: "pointer",
              background: !worldView
                ? "rgba(255,107,0,0.12)"
                : "rgba(255,255,255,0.04)",
              border: !worldView
                ? "1px solid rgba(255,107,0,0.45)"
                : "1px solid rgba(255,255,255,0.08)",
              color: !worldView ? "#FFB470" : "#AAA",
              backdropFilter: "blur(12px)",
              boxShadow: !worldView ? "0 0 0 1px rgba(255,107,0,0.15)" : "none",
            }}
          >
            <Search size={18} />
          </button>

          <button
            onClick={() => setWorldView(true)}
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              cursor: "pointer",
              background: worldView
                ? "rgba(255,107,0,0.12)"
                : "rgba(255,255,255,0.04)",
              border: worldView
                ? "1px solid rgba(255,107,0,0.45)"
                : "1px solid rgba(255,255,255,0.08)",
              color: worldView ? "#FFB470" : "#AAA",
              backdropFilter: "blur(12px)",
              boxShadow: worldView ? "0 0 0 1px rgba(255,107,0,0.15)" : "none",
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
            borderRadius: "16px",
            background: "#050505",
            border: "1px solid rgba(255,107,0,0.12)",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            background: "rgba(255,107,0,0.08)",
            border: "1px solid rgba(255,107,0,0.2)",
            borderRadius: "12px",
            padding: "12px 20px",
            minWidth: "180px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#888",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            Photos Scanned
          </div>

          <div
            style={{
              fontSize: "32px",
              fontWeight: "bold",
              color: "#FFF",
            }}
          >
            {photosScanned}
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,107,0,0.08)",
            border: "1px solid rgba(255,107,0,0.2)",
            borderRadius: "12px",
            padding: "12px 20px",
            minWidth: "180px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#888",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            GPS Tagged
          </div>

          <div
            style={{
              fontSize: "32px",
              fontWeight: "bold",
              color: "#FFF",
            }}
          >
            {gpsTagged}
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,107,0,0.08)",
            border: "1px solid rgba(255,107,0,0.2)",
            borderRadius: "12px",
            padding: "12px 20px",
            minWidth: "180px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#888",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            Devices Found
          </div>

          <div
            style={{
              fontSize: "32px",
              fontWeight: "bold",
              color: "#FFF",
            }}
          >
            {devicesFound}
          </div>
        </div>
        <div
          style={{
            background:
              riskScore > 70 ? "rgba(255,68,68,0.08)" : "rgba(255,107,0,0.08)",
            border:
              riskScore > 70
                ? "1px solid rgba(255,68,68,0.2)"
                : "1px solid rgba(255,107,0,0.2)",
            borderRadius: "12px",
            padding: "12px 20px",
            minWidth: "180px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#888",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            Risk Score
          </div>

          <div
            style={{
              fontSize: "32px",
              fontWeight: "bold",
              color: riskScore > 70 ? "#FF4444" : "#FF6B00",
            }}
          >
            {riskScore}
          </div>
        </div>
      </div>
      <div
        style={{
          marginBottom: "20px",
          padding: "16px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,107,0,0.12)",
          borderRadius: "12px",
        }}
      >
        <div
          style={{
            color: "#FFF",
            fontWeight: 600,
            marginBottom: "12px",
          }}
        >
          Key Findings
        </div>

        <div
          style={{
            color: "#BBB",
            lineHeight: 1.8,
          }}
        >
          <div>• {gpsTagged} GPS-tagged photos discovered</div>
          <div>• {devicesFound} devices contain location metadata</div>
          <div>• Historical movement patterns may be reconstructed</div>
          <div>• High privacy exposure risk identified</div>
        </div>
      </div>
      <div
        style={{
          marginBottom: "20px",
          padding: "16px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,107,0,0.12)",
          borderRadius: "12px",
        }}
      >
        <div
          style={{
            color: "#FFF",
            fontWeight: 600,
            marginBottom: "12px",
          }}
        >
          Device Breakdown
        </div>

        {deviceStats.map(([device, count]) => (
          <div
            key={device}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              color: "#BBB",
            }}
          >
            <span>{device}</span>
            <span>{count} photos</span>
          </div>
        ))}
      </div>

      {tooltip.visible && tooltip.location && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x,
            top: tooltip.y,
            background: "rgba(12,12,12,0.95)",
            border: "1px solid rgba(255,77,0,0.3)",
            borderRadius: "8px",
            padding: "12px",
            minWidth: "220px",
            pointerEvents: "none",
            zIndex: 9999,
            backdropFilter: "blur(8px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              color: "#FF6B00",
              fontWeight: 700,
              marginBottom: "8px",
            }}
          >
            {tooltip.location.filename ||
              tooltip.location.fileName ||
              "Unknown File"}
          </div>

          <div style={{ color: "#888", fontSize: "11px" }}>COORDS</div>

          <div style={{ color: "#FFF", marginBottom: "8px" }}>
            {Number(tooltip.location.lat).toFixed(4)},{" "}
            {Number(tooltip.location.lon).toFixed(4)}
          </div>

          <div style={{ color: "#888", fontSize: "11px" }}>DEVICE</div>

          <div style={{ color: "#FFF", marginBottom: "8px" }}>
            {tooltip.location.device_model ||
              tooltip.location.device ||
              "Unknown Device"}
          </div>

          <div style={{ color: "#888", fontSize: "11px" }}>DATE</div>

          <div style={{ color: "#FFF" }}>
            {tooltip.location.date_taken || tooltip.location.date || "Unknown"}
          </div>
        </div>
      )}
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
