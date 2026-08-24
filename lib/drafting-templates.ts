import type { RFxDraft } from "@/types/index";

/** Pre-saved template drafts — loaded instantly without an LLM call. */
export const TEMPLATES: Record<string, Partial<RFxDraft>> = {

  // ──────────────────────────────────────────────────
  // TEMPLATE 1: 1,000 Laptops
  // ──────────────────────────────────────────────────
  laptops: {
    title: "RFQ — 1,000 Engineering Laptops",
    event_type: "RFQ",
    description: "Procurement of 1,000 high-performance laptops for our engineering and product teams. Vendors must supply a single model meeting or exceeding the minimum specifications.",
    background: "Our organisation is expanding its engineering headcount by 1,000 this financial year. We require enterprise-grade laptops with 3-year on-site warranty support, delivered to our UK headquarters.",
    late_response_rule: "hold",
    evaluation_criteria: [
      { criterion: "Total Price / 5-Year TCO", weight: 35, description: "Lowest lifetime cost of ownership wins" },
      { criterion: "Technical Specification Compliance", weight: 25, description: "Match or exceed all minimum specs" },
      { criterion: "Warranty & Support Quality", weight: 20, description: "On-site response time, coverage breadth" },
      { criterion: "Delivery Lead Time", weight: 10, description: "Ability to deliver all 1,000 units within 12 weeks" },
      { criterion: "Sustainability", weight: 10, description: "Energy Star, recycled content, take-back programme" },
    ],
    schema_fields: [
      // Pricing
      { field_key: "unit_price", label: "Unit Price (per laptop)", section: "Pricing", data_type: "currency", currency_code: "GBP", required: true, is_price_field: true, help_text: "State the price per unit excluding VAT. Include all standard accessories (charger, bag). Format: £ per unit." },
      { field_key: "freight_per_unit", label: "Freight Cost (per unit)", section: "Pricing", data_type: "currency", currency_code: "GBP", required: true, is_price_field: true, help_text: "Delivery cost per unit to our UK HQ. If included in unit price, state £0." },
      { field_key: "extended_warranty_price", label: "Extended Warranty Price (per unit, yr 4–5)", section: "Pricing", data_type: "currency", currency_code: "GBP", required: false, is_price_field: true, help_text: "Optional price to extend warranty to 5 years per unit." },
      { field_key: "volume_discount_500", label: "Volume Discount at 500 units (%)", section: "Pricing", data_type: "number", required: false, is_price_field: false, help_text: "Percentage discount offered if order quantity is 500 units. State 0 if none." },
      { field_key: "five_year_tco", label: "5-Year Total Cost of Ownership (per unit)", section: "Pricing", data_type: "currency", currency_code: "GBP", required: true, is_price_field: true, help_text: "Sum of unit price + freight + 5-yr warranty + expected repair costs per unit over 5 years." },
      // Technical Specifications
      { field_key: "brand_model", label: "Brand & Model", section: "Technical Specifications", data_type: "text", required: true, is_price_field: false, help_text: "State the exact manufacturer and model name (e.g. Dell Latitude 5540, HP EliteBook 840 G10)." },
      { field_key: "processor_model", label: "Processor Model", section: "Technical Specifications", data_type: "text", required: true, is_price_field: false, help_text: "State the exact CPU model (e.g. Intel Core Ultra 7 165H). Minimum: Intel Core i7 13th Gen or AMD Ryzen 7 7000 series." },
      { field_key: "ram_gb", label: "RAM (GB)", section: "Technical Specifications", data_type: "number", required: true, is_price_field: false, help_text: "Total installed RAM in GB. Minimum requirement: 32 GB. State actual value." },
      { field_key: "storage_gb", label: "Storage Capacity (GB)", section: "Technical Specifications", data_type: "number", required: true, is_price_field: false, help_text: "SSD storage in GB. Minimum requirement: 1,000 GB (1 TB)." },
      { field_key: "storage_type", label: "Storage Type", section: "Technical Specifications", data_type: "select", required: true, is_price_field: false, help_text: "Type of primary storage. Must be NVMe SSD.", options: [{ value: "nvme_ssd", label: "NVMe SSD" }, { value: "sata_ssd", label: "SATA SSD" }, { value: "hdd", label: "HDD" }] },
      { field_key: "display_size_inches", label: "Display Size (inches)", section: "Technical Specifications", data_type: "number", required: true, is_price_field: false, help_text: "Screen diagonal in inches. Acceptable range: 14–16 inches." },
      { field_key: "display_resolution", label: "Display Resolution", section: "Technical Specifications", data_type: "text", required: true, is_price_field: false, help_text: "Native display resolution (e.g. 1920×1200, 2560×1600). Minimum: 1920×1200." },
      { field_key: "battery_life_hours", label: "Battery Life (hours, typical use)", section: "Technical Specifications", data_type: "number", required: true, is_price_field: false, help_text: "Manufacturer-rated battery life under typical mixed workload in hours. Minimum: 10 hours." },
      { field_key: "weight_kg", label: "Weight (kg)", section: "Technical Specifications", data_type: "number", required: true, is_price_field: false, help_text: "Device weight in kg, without external accessories. Maximum: 2.0 kg preferred." },
      // Commercial Terms
      { field_key: "payment_terms", label: "Payment Terms", section: "Commercial Terms", data_type: "select", required: true, is_price_field: false, help_text: "Preferred payment terms.", options: [{ value: "net30", label: "Net 30" }, { value: "net60", label: "Net 60" }, { value: "50_50", label: "50% upfront / 50% on delivery" }, { value: "other", label: "Other (specify in notes)" }] },
      { field_key: "price_validity_days", label: "Price Validity (days)", section: "Commercial Terms", data_type: "number", required: true, is_price_field: false, help_text: "Number of calendar days your quoted price remains valid from submission date. Minimum: 90 days." },
      { field_key: "incoterms", label: "Incoterms", section: "Commercial Terms", data_type: "select", required: true, is_price_field: false, options: [{ value: "DDP", label: "DDP – Delivered Duty Paid" }, { value: "DAP", label: "DAP – Delivered at Place" }, { value: "EXW", label: "EXW – Ex Works" }], help_text: "Incoterms 2020 applicable to this order." },
      // Compliance & Certifications
      { field_key: "energy_star_certified", label: "Energy Star Certified?", section: "Compliance & Certifications", data_type: "boolean", required: true, is_price_field: false, help_text: "Is the proposed model Energy Star 8.0 or later certified? Yes/No." },
      { field_key: "rohs_compliant", label: "RoHS Compliant?", section: "Compliance & Certifications", data_type: "boolean", required: true, is_price_field: false, help_text: "Does the device comply with EU RoHS Directive 2011/65/EU? Yes/No." },
      { field_key: "country_of_manufacture", label: "Country of Manufacture", section: "Compliance & Certifications", data_type: "text", required: true, is_price_field: false, help_text: "Country where the device is assembled/manufactured. Required for import compliance." },
      // Logistics & Delivery
      { field_key: "lead_time_weeks", label: "Delivery Lead Time (weeks, full order)", section: "Logistics & Delivery", data_type: "number", required: true, is_price_field: false, help_text: "Weeks from purchase order to delivery of all 1,000 units at our UK HQ. Maximum acceptable: 12 weeks." },
      { field_key: "staged_delivery_available", label: "Staged Delivery Available?", section: "Logistics & Delivery", data_type: "boolean", required: false, is_price_field: false, help_text: "Can you deliver in batches (e.g. 250 units/month)? Preferred." },
      // After-Sales Support
      { field_key: "warranty_years", label: "Warranty Period (years)", section: "After-Sales Support", data_type: "number", required: true, is_price_field: false, help_text: "Standard warranty duration in years. Minimum: 3 years on-site." },
      { field_key: "onsite_support_sla_hours", label: "On-Site Support Response SLA (hours)", section: "After-Sales Support", data_type: "number", required: true, is_price_field: false, help_text: "Maximum hours from fault report to on-site engineer arrival. Maximum acceptable: 8 business hours." },
      { field_key: "dedicated_account_manager", label: "Dedicated Account Manager?", section: "After-Sales Support", data_type: "boolean", required: false, is_price_field: false, help_text: "Will a named account manager be assigned to this contract? Yes/No." },
      // Sustainability
      { field_key: "recycled_content_pct", label: "Recycled Content (%)", section: "Sustainability", data_type: "number", required: false, is_price_field: false, help_text: "Percentage of device materials sourced from recycled content. State 0 if none." },
      { field_key: "carbon_footprint_kg_co2", label: "Product Carbon Footprint (kg CO₂e)", section: "Sustainability", data_type: "number", required: false, is_price_field: false, help_text: "Cradle-to-gate carbon footprint in kg CO₂ equivalent per unit, per manufacturer LCA data." },
      { field_key: "take_back_programme", label: "Device Take-Back Programme?", section: "Sustainability", data_type: "boolean", required: false, is_price_field: false, help_text: "Do you offer a certified end-of-life device recovery / recycling programme? Yes/No." },
    ],
  },

  // ──────────────────────────────────────────────────
  // TEMPLATE 2: 1,000 Office Chairs
  // ──────────────────────────────────────────────────
  chairs: {
    title: "RFQ — 1,000 Office Chairs (Lot 1: Task, Lot 2: Executive)",
    event_type: "RFQ",
    description: "Procurement of 1,000 office chairs split into two lots: Lot 1 — 700 ergonomic task chairs (EN 1335 certified); Lot 2 — 300 executive chairs. Delivery and installation required at our Amsterdam HQ.",
    background: "We are fitting out a new 10-floor headquarters in Amsterdam for 1,000 staff. Chairs must meet EN 1335 ergonomic standards, carry a minimum 5-year warranty, and be delivered with full installation service.",
    late_response_rule: "hold",
    evaluation_criteria: [
      { criterion: "Price / 5-Year TCO", weight: 35, description: "Unit price, installation, and maintenance over 5 years" },
      { criterion: "Ergonomic & Technical Compliance", weight: 25, description: "EN 1335 cert, adjustability, cycle test rating" },
      { criterion: "Warranty & After-Sales", weight: 20, description: "Warranty length, spare parts, on-site repair SLA" },
      { criterion: "Delivery & Installation", weight: 10, description: "On-time full installation in Amsterdam HQ" },
      { criterion: "Sustainability", weight: 10, description: "Recycled content, carbon footprint, EPD availability" },
    ],
    schema_fields: [
      // Pricing — per lot
      { field_key: "unit_price_lot1_task", label: "Unit Price — Lot 1 Task Chair", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Price per ergonomic task chair (Lot 1), excluding VAT and installation. Format: € per unit." },
      { field_key: "unit_price_lot2_executive", label: "Unit Price — Lot 2 Executive Chair", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Price per executive chair (Lot 2), excluding VAT and installation. Format: € per unit." },
      { field_key: "freight_per_unit", label: "Freight / Delivery Cost (per unit)", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Delivery cost per chair to Amsterdam HQ. State 0 if included in unit price." },
      { field_key: "installation_cost_per_unit", label: "Installation Cost (per chair)", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Cost to assemble and position each chair on-site in Amsterdam. State 0 if included in unit price." },
      { field_key: "five_year_tco", label: "5-Year Total Cost of Ownership (per chair)", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Sum of unit price + freight + installation + expected maintenance per chair over 5 years." },
      { field_key: "grand_total", label: "Grand Total — All Lots (1,000 chairs)", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Total contract value for all 700 task chairs + 300 executive chairs, including delivery and installation." },
      // Technical Specifications
      { field_key: "brand_model_lot1", label: "Brand & Model — Lot 1 (Task Chair)", section: "Technical Specifications", data_type: "text", required: true, is_price_field: false, help_text: "Exact manufacturer and model name for the proposed task chair." },
      { field_key: "brand_model_lot2", label: "Brand & Model — Lot 2 (Executive Chair)", section: "Technical Specifications", data_type: "text", required: true, is_price_field: false, help_text: "Exact manufacturer and model name for the proposed executive chair." },
      { field_key: "weight_capacity_kg", label: "Weight Capacity (kg)", section: "Technical Specifications", data_type: "number", required: true, is_price_field: false, help_text: "Maximum rated user weight in kg. Minimum requirement: 120 kg." },
      { field_key: "cycle_test_rating", label: "Cycle Test Rating (cycles)", section: "Technical Specifications", data_type: "number", required: true, is_price_field: false, help_text: "Number of tilt/sit cycles the chair is rated for (e.g. 200,000). Higher is better." },
      { field_key: "seat_height_range_mm", label: "Seat Height Adjustment Range (mm)", section: "Technical Specifications", data_type: "text", required: true, is_price_field: false, help_text: "Min–Max seat height in mm (e.g. 420–520 mm). Range must accommodate 5th–95th percentile users." },
      { field_key: "armrest_type", label: "Armrest Type", section: "Technical Specifications", data_type: "select", required: true, is_price_field: false, options: [{ value: "4d", label: "4D Adjustable" }, { value: "3d", label: "3D Adjustable" }, { value: "2d", label: "2D Adjustable" }, { value: "fixed", label: "Fixed" }], help_text: "Describe armrest adjustability. 4D (height, width, depth, angle) preferred." },
      { field_key: "material_seat", label: "Seat & Back Material", section: "Technical Specifications", data_type: "text", required: true, is_price_field: false, help_text: "Describe upholstery material (e.g. mesh back / fabric seat, full leather, vegan leather). Executive chairs (Lot 2) should be leather or vegan leather." },
      // Commercial Terms
      { field_key: "payment_terms", label: "Payment Terms", section: "Commercial Terms", data_type: "select", required: true, is_price_field: false, options: [{ value: "net30", label: "Net 30" }, { value: "net60", label: "Net 60" }, { value: "50_50", label: "50% upfront / 50% on delivery" }], help_text: "Preferred payment terms for this order." },
      { field_key: "price_validity_days", label: "Price Validity (days)", section: "Commercial Terms", data_type: "number", required: true, is_price_field: false, help_text: "Days your quoted price remains firm from submission date. Minimum: 90 days." },
      { field_key: "incoterms", label: "Incoterms", section: "Commercial Terms", data_type: "select", required: true, is_price_field: false, options: [{ value: "DDP", label: "DDP – Delivered Duty Paid" }, { value: "DAP", label: "DAP – Delivered at Place" }], help_text: "Incoterms 2020. DDP preferred — buyer should not handle customs clearance." },
      // Compliance & Certifications
      { field_key: "en1335_certified", label: "EN 1335 Certified?", section: "Compliance & Certifications", data_type: "boolean", required: true, is_price_field: false, help_text: "Is the task chair certified to EN 1335-1/2/3 European ergonomic standard? Yes/No. Mandatory for Lot 1." },
      { field_key: "iso9001_certified", label: "ISO 9001 Certified (Manufacturer)?", section: "Compliance & Certifications", data_type: "boolean", required: true, is_price_field: false, help_text: "Does the manufacturer hold ISO 9001:2015 quality management certification? Yes/No." },
      { field_key: "greenguard_certified", label: "GREENGUARD Gold Certified?", section: "Compliance & Certifications", data_type: "boolean", required: false, is_price_field: false, help_text: "Does the chair carry GREENGUARD Gold certification for low chemical emissions? Yes/No." },
      // Logistics & Delivery
      { field_key: "lead_time_weeks", label: "Delivery Lead Time (weeks, full order)", section: "Logistics & Delivery", data_type: "number", required: true, is_price_field: false, help_text: "Weeks from purchase order to completed installation of all 1,000 chairs in Amsterdam. Maximum: 14 weeks." },
      { field_key: "installation_plan", label: "Installation Plan (describe)", section: "Logistics & Delivery", data_type: "textarea", required: true, is_price_field: false, help_text: "Describe your installation methodology, crew size, daily throughput rate, and floor-by-floor sequencing approach." },
      // After-Sales Support
      { field_key: "warranty_years", label: "Warranty Period (years)", section: "After-Sales Support", data_type: "number", required: true, is_price_field: false, help_text: "Standard warranty in years. Minimum requirement: 5 years comprehensive (parts + labour)." },
      { field_key: "spare_parts_availability_years", label: "Spare Parts Availability (years post-delivery)", section: "After-Sales Support", data_type: "number", required: true, is_price_field: false, help_text: "How many years post-delivery will spare parts remain available? Minimum: 8 years." },
      // Sustainability
      { field_key: "recycled_content_pct", label: "Recycled Content (%)", section: "Sustainability", data_type: "number", required: false, is_price_field: false, help_text: "Percentage by weight of materials sourced from recycled/reclaimed content." },
      { field_key: "carbon_footprint_kg_co2", label: "Product Carbon Footprint (kg CO₂e per chair)", section: "Sustainability", data_type: "number", required: false, is_price_field: false, help_text: "Cradle-to-gate carbon footprint per chair in kg CO₂e, per LCA or EPD data." },
      { field_key: "epd_available", label: "Environmental Product Declaration (EPD) Available?", section: "Sustainability", data_type: "boolean", required: false, is_price_field: false, help_text: "Has an EPD (ISO 14025) been published for this product? Yes/No. If yes, please attach." },
    ],
  },

  // ──────────────────────────────────────────────────
  // TEMPLATE 3: 500 WiFi Routers
  // ──────────────────────────────────────────────────
  routers: {
    title: "RFQ — 500 Enterprise WiFi 6E Access Points",
    event_type: "RFQ",
    description: "Procurement of 500 enterprise-grade WiFi 6E access points for campus network expansion, including installation, cloud management platform, and 3-year 24/7 NOC support.",
    background: "We are expanding our campus network across 10 buildings to support 5,000 concurrent users. Vendors must supply hardware, perform professional installation, and provide ongoing centralised management and support.",
    late_response_rule: "hold",
    evaluation_criteria: [
      { criterion: "Total Price / 5-Year TCO", weight: 30, description: "Hardware, installation, and support contract pricing" },
      { criterion: "Technical Performance", weight: 30, description: "Throughput, coverage, MU-MIMO, band steering, roaming" },
      { criterion: "Management Platform", weight: 15, description: "Ease of cloud management, analytics, zero-touch provisioning" },
      { criterion: "Support SLA & NOC", weight: 15, description: "24/7 NOC response times, MTTR commitments" },
      { criterion: "Sustainability & Compliance", weight: 10, description: "Energy efficiency, certifications" },
    ],
    schema_fields: [
      // Pricing
      { field_key: "unit_price", label: "Unit Price (per access point)", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Hardware price per access point, excluding installation and support. Format: € per unit." },
      { field_key: "installation_cost_per_ap", label: "Installation Cost (per access point)", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Labour cost to mount, cable, configure, and commission each AP on-site." },
      { field_key: "annual_management_fee", label: "Annual Cloud Management Fee (per AP)", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Annual licensing/subscription fee per AP for cloud management platform. State 0 if included in hardware price." },
      { field_key: "annual_support_fee", label: "Annual NOC Support Fee (per AP)", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Annual cost for 24/7 NOC monitoring and support per AP." },
      { field_key: "five_year_tco", label: "5-Year Total Cost of Ownership (per AP)", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Unit price + installation + 5 years management + 5 years support per AP." },
      // Technical Specifications
      { field_key: "brand_model", label: "Brand & Model", section: "Technical Specifications", data_type: "text", required: true, is_price_field: false, help_text: "Exact manufacturer and model name (e.g. Cisco Catalyst 9136, Aruba AP-635)." },
      { field_key: "wifi_standard", label: "WiFi Standard", section: "Technical Specifications", data_type: "select", required: true, is_price_field: false, options: [{ value: "wifi7", label: "WiFi 7 (802.11be)" }, { value: "wifi6e", label: "WiFi 6E (802.11ax 6 GHz)" }, { value: "wifi6", label: "WiFi 6 (802.11ax)" }], help_text: "WiFi standard supported. Minimum requirement: WiFi 6E (tri-band with 6 GHz)." },
      { field_key: "max_throughput_mbps", label: "Maximum Aggregate Throughput (Mbps)", section: "Technical Specifications", data_type: "number", required: true, is_price_field: false, help_text: "Combined maximum throughput across all bands in Mbps (e.g. 10,755 Mbps for WiFi 6E). Minimum: 5,000 Mbps." },
      { field_key: "mu_mimo_streams", label: "MU-MIMO Spatial Streams", section: "Technical Specifications", data_type: "number", required: true, is_price_field: false, help_text: "Number of MU-MIMO spatial streams (e.g. 8). More streams = more simultaneous clients." },
      { field_key: "concurrent_clients", label: "Max Concurrent Clients (per AP)", section: "Technical Specifications", data_type: "number", required: true, is_price_field: false, help_text: "Maximum number of concurrently associated clients per AP under typical office load. Minimum: 100." },
      { field_key: "poe_standard", label: "PoE Standard", section: "Technical Specifications", data_type: "select", required: true, is_price_field: false, options: [{ value: "poe_plus_plus", label: "PoE++ (802.3bt, 90W)" }, { value: "poe_plus", label: "PoE+ (802.3at, 30W)" }, { value: "poe", label: "PoE (802.3af, 15.4W)" }], help_text: "PoE standard required from switch. Minimum PoE+ (802.3at). State actual power draw in Watts." },
      { field_key: "coverage_area_sqm", label: "Typical Coverage Area (m²)", section: "Technical Specifications", data_type: "number", required: true, is_price_field: false, help_text: "Typical office coverage area per AP in square metres at minimum acceptable signal (-70 dBm)." },
      { field_key: "management_platform", label: "Management Platform", section: "Technical Specifications", data_type: "text", required: true, is_price_field: false, help_text: "Name and type of management platform (e.g. Cisco DNA Center cloud, Aruba Central). State whether cloud-hosted or on-premises." },
      { field_key: "zero_touch_provisioning", label: "Zero-Touch Provisioning?", section: "Technical Specifications", data_type: "boolean", required: true, is_price_field: false, help_text: "Does the management platform support zero-touch provisioning for new APs? Yes/No." },
      // Commercial Terms
      { field_key: "payment_terms", label: "Payment Terms", section: "Commercial Terms", data_type: "select", required: true, is_price_field: false, options: [{ value: "net30", label: "Net 30" }, { value: "net60", label: "Net 60" }, { value: "milestone", label: "Milestone-based" }], help_text: "Preferred payment terms. Hardware on delivery; support billed annually preferred." },
      { field_key: "price_validity_days", label: "Price Validity (days)", section: "Commercial Terms", data_type: "number", required: true, is_price_field: false, help_text: "Days your quoted price remains firm. Minimum: 90 days." },
      { field_key: "support_contract_term_years", label: "Support Contract Term (years)", section: "Commercial Terms", data_type: "number", required: true, is_price_field: false, help_text: "Minimum and maximum support contract term in years. State if multi-year discounts are available." },
      // Compliance & Certifications
      { field_key: "ce_certified", label: "CE Certified?", section: "Compliance & Certifications", data_type: "boolean", required: true, is_price_field: false, help_text: "Does the AP carry CE marking for EU market? Yes/No. Mandatory." },
      { field_key: "wpa3_enterprise", label: "WPA3-Enterprise Support?", section: "Compliance & Certifications", data_type: "boolean", required: true, is_price_field: false, help_text: "Does the AP support WPA3-Enterprise (802.1X) authentication? Yes/No. Mandatory." },
      { field_key: "iso27001_certified", label: "ISO 27001 Certified (Company)?", section: "Compliance & Certifications", data_type: "boolean", required: true, is_price_field: false, help_text: "Does your company hold ISO 27001 Information Security certification? Yes/No." },
      // Logistics & Delivery
      { field_key: "lead_time_weeks", label: "Delivery Lead Time (weeks, all 500 APs)", section: "Logistics & Delivery", data_type: "number", required: true, is_price_field: false, help_text: "Weeks from purchase order to completed installation of all 500 APs. Include site survey in timeline." },
      { field_key: "site_survey_included", label: "Pre-Installation Site Survey Included?", section: "Logistics & Delivery", data_type: "boolean", required: true, is_price_field: false, help_text: "Is a professional RF site survey and AP placement plan included in your proposal? Yes/No." },
      // After-Sales Support
      { field_key: "warranty_years", label: "Hardware Warranty (years)", section: "After-Sales Support", data_type: "number", required: true, is_price_field: false, help_text: "Standard hardware warranty in years. Minimum: 3 years advance replacement." },
      { field_key: "noc_response_sla_minutes", label: "NOC Response SLA (minutes)", section: "After-Sales Support", data_type: "number", required: true, is_price_field: false, help_text: "Maximum time in minutes from alert to NOC engineer acknowledgement (24/7/365). Maximum acceptable: 15 minutes." },
      { field_key: "mttr_hours", label: "Mean Time to Restore (MTTR, hours)", section: "After-Sales Support", data_type: "number", required: true, is_price_field: false, help_text: "Committed MTTR in hours for critical network outages. State your guaranteed SLA." },
      // Sustainability
      { field_key: "energy_consumption_watts", label: "Typical Power Consumption (Watts)", section: "Sustainability", data_type: "number", required: true, is_price_field: false, help_text: "Typical power draw per AP under normal load in Watts. Used for energy cost calculation." },
      { field_key: "energy_star_certified", label: "Energy Star Certified?", section: "Sustainability", data_type: "boolean", required: false, is_price_field: false, help_text: "Is the AP Energy Star certified for networking equipment? Yes/No." },
    ],
  },

  // ──────────────────────────────────────────────────
  // TEMPLATE 4: All Three Together (Multi-Lot)
  // ──────────────────────────────────────────────────
  all_three: {
    title: "RFQ — Multi-Lot: 1,000 Laptops + 1,000 Office Chairs + 500 WiFi APs",
    event_type: "RFQ",
    description: "Three-lot RFQ for our office expansion: Lot 1 – 1,000 engineering laptops; Lot 2 – 1,000 office chairs (700 task + 300 executive); Lot 3 – 500 WiFi 6E enterprise access points with installation and 3-year NOC support.",
    background: "As part of a major office expansion, we are procuring hardware, furniture, and network infrastructure simultaneously. Vendors may bid on one lot, multiple lots, or all three. Multi-lot bids with integrated pricing are welcome.",
    late_response_rule: "hold",
    evaluation_criteria: [
      { criterion: "Total Price / 5-Year TCO (all lots)", weight: 35, description: "Lowest total lifecycle cost across all relevant lots" },
      { criterion: "Technical Compliance", weight: 25, description: "Meeting all minimum specifications per lot" },
      { criterion: "Delivery Schedule", weight: 20, description: "Ability to deliver all lots within 14 weeks" },
      { criterion: "After-Sales Support", weight: 10, description: "Warranty, SLAs, account management" },
      { criterion: "Sustainability", weight: 10, description: "Recycled content, energy efficiency, certifications" },
    ],
    schema_fields: [
      // Lot 1 Pricing — Laptops
      { field_key: "unit_price_lot1", label: "Unit Price — Lot 1 Laptop", section: "Pricing", data_type: "currency", currency_code: "GBP", required: true, is_price_field: true, help_text: "Price per laptop (Lot 1) excluding VAT. Format: £ per unit." },
      { field_key: "tco_5yr_lot1", label: "5-Year TCO — Lot 1 Laptops (per unit)", section: "Pricing", data_type: "currency", currency_code: "GBP", required: true, is_price_field: true, help_text: "5-year total cost of ownership per laptop including warranty and support." },
      // Lot 2 Pricing — Chairs
      { field_key: "unit_price_lot2_task", label: "Unit Price — Lot 2a Task Chair", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Price per ergonomic task chair (700 units) excluding installation." },
      { field_key: "unit_price_lot2_exec", label: "Unit Price — Lot 2b Executive Chair", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Price per executive chair (300 units) excluding installation." },
      { field_key: "installation_cost_lot2", label: "Installation Cost — Lot 2 Chairs (per unit)", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Per-chair on-site installation cost in Amsterdam HQ." },
      // Lot 3 Pricing — WiFi
      { field_key: "unit_price_lot3", label: "Unit Price — Lot 3 WiFi AP", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Hardware price per WiFi 6E access point (Lot 3), excluding installation and support." },
      { field_key: "installation_cost_lot3", label: "Installation + Commissioning — Lot 3 (per AP)", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Full installation and network commissioning cost per access point." },
      { field_key: "annual_noc_fee_lot3", label: "Annual NOC Support — Lot 3 (per AP)", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Annual 24/7 NOC monitoring and support fee per access point." },
      { field_key: "grand_total_all_lots", label: "Grand Total — All Lots", section: "Pricing", data_type: "currency", currency_code: "EUR", required: true, is_price_field: true, help_text: "Total contract value across all three lots including installation, support, and delivery." },
      // Lot 1 Technical — Laptops
      { field_key: "laptop_brand_model", label: "Laptop — Brand & Model (Lot 1)", section: "Technical Specifications", data_type: "text", required: true, is_price_field: false, help_text: "Exact brand and model. Minimum: 32GB RAM, 1TB NVMe SSD, 14–16 inch, 10+ hr battery." },
      { field_key: "laptop_ram_gb", label: "Laptop — RAM (GB)", section: "Technical Specifications", data_type: "number", required: true, is_price_field: false, help_text: "Installed RAM in GB. Minimum: 32 GB." },
      { field_key: "laptop_storage_gb", label: "Laptop — Storage (GB)", section: "Technical Specifications", data_type: "number", required: true, is_price_field: false, help_text: "NVMe SSD capacity in GB. Minimum: 1,000 GB." },
      // Lot 2 Technical — Chairs
      { field_key: "chair_en1335_certified", label: "Task Chair — EN 1335 Certified? (Lot 2)", section: "Technical Specifications", data_type: "boolean", required: true, is_price_field: false, help_text: "Is the task chair certified to EN 1335 European ergonomic standard? Mandatory for Lot 2 task chairs." },
      { field_key: "chair_weight_capacity_kg", label: "Chair — Weight Capacity (kg)", section: "Technical Specifications", data_type: "number", required: true, is_price_field: false, help_text: "Rated maximum user weight in kg. Minimum: 120 kg." },
      // Lot 3 Technical — WiFi
      { field_key: "ap_wifi_standard", label: "WiFi AP — Standard (Lot 3)", section: "Technical Specifications", data_type: "select", required: true, is_price_field: false, options: [{ value: "wifi7", label: "WiFi 7" }, { value: "wifi6e", label: "WiFi 6E" }, { value: "wifi6", label: "WiFi 6" }], help_text: "WiFi standard. Minimum: WiFi 6E tri-band." },
      { field_key: "ap_max_throughput_mbps", label: "WiFi AP — Max Throughput (Mbps)", section: "Technical Specifications", data_type: "number", required: true, is_price_field: false, help_text: "Aggregate maximum throughput in Mbps. Minimum: 5,000 Mbps." },
      { field_key: "ap_poe_standard", label: "WiFi AP — PoE Standard", section: "Technical Specifications", data_type: "text", required: true, is_price_field: false, help_text: "PoE standard and power draw in Watts (e.g. PoE+ 802.3at, 25W typical)." },
      // Commercial Terms
      { field_key: "payment_terms", label: "Payment Terms", section: "Commercial Terms", data_type: "select", required: true, is_price_field: false, options: [{ value: "net30", label: "Net 30" }, { value: "net60", label: "Net 60" }, { value: "milestone", label: "Milestone-based" }], help_text: "Preferred payment terms across all lots." },
      { field_key: "multi_lot_discount_pct", label: "Multi-Lot Discount (%)", section: "Commercial Terms", data_type: "number", required: false, is_price_field: false, help_text: "Additional discount offered for bidding on 2 or all 3 lots simultaneously. State 0 if none." },
      { field_key: "price_validity_days", label: "Price Validity (days)", section: "Commercial Terms", data_type: "number", required: true, is_price_field: false, help_text: "Days prices remain firm from submission date. Minimum: 90 days." },
      // Compliance
      { field_key: "energy_star_laptops", label: "Energy Star — Laptops?", section: "Compliance & Certifications", data_type: "boolean", required: true, is_price_field: false, help_text: "Are proposed laptops Energy Star 8.0+ certified? Yes/No." },
      { field_key: "iso9001_all_vendors", label: "ISO 9001 Certified (your company)?", section: "Compliance & Certifications", data_type: "boolean", required: true, is_price_field: false, help_text: "Does your company hold ISO 9001:2015? Yes/No." },
      // Logistics
      { field_key: "lead_time_weeks_lot1", label: "Delivery Lead Time — Lot 1 Laptops (weeks)", section: "Logistics & Delivery", data_type: "number", required: true, is_price_field: false, help_text: "Weeks from PO to delivery of all 1,000 laptops to UK HQ. Maximum: 12 weeks." },
      { field_key: "lead_time_weeks_lots2_3", label: "Delivery Lead Time — Lots 2 & 3 (weeks)", section: "Logistics & Delivery", data_type: "number", required: true, is_price_field: false, help_text: "Weeks from PO to completed installation of all chairs and WiFi APs in Amsterdam. Maximum: 14 weeks." },
      // After-Sales
      { field_key: "warranty_years_laptops", label: "Laptop Warranty (years, Lot 1)", section: "After-Sales Support", data_type: "number", required: true, is_price_field: false, help_text: "Warranty period in years for laptops. Minimum: 3 years on-site." },
      { field_key: "warranty_years_chairs", label: "Chair Warranty (years, Lot 2)", section: "After-Sales Support", data_type: "number", required: true, is_price_field: false, help_text: "Warranty period in years for chairs. Minimum: 5 years comprehensive." },
      { field_key: "noc_sla_minutes", label: "WiFi NOC Response SLA (minutes, Lot 3)", section: "After-Sales Support", data_type: "number", required: true, is_price_field: false, help_text: "Maximum minutes to NOC acknowledgement of a critical alert. Maximum: 15 minutes." },
      // Sustainability
      { field_key: "recycled_content_laptops_pct", label: "Recycled Content — Laptops (%)", section: "Sustainability", data_type: "number", required: false, is_price_field: false, help_text: "% recycled materials in proposed laptop by weight." },
      { field_key: "recycled_content_chairs_pct", label: "Recycled Content — Chairs (%)", section: "Sustainability", data_type: "number", required: false, is_price_field: false, help_text: "% recycled materials in proposed chairs by weight." },
      { field_key: "carbon_offset_programme", label: "Carbon Offset Programme?", section: "Sustainability", data_type: "boolean", required: false, is_price_field: false, help_text: "Does your company operate a verified carbon offset or net-zero programme? Yes/No." },
    ],
  },
};

/** Opening assistant message shown when a template is loaded */
export const TEMPLATE_GREETINGS: Record<string, string> = {
  laptops: `I've drafted a comprehensive RFQ for 1,000 engineering laptops — 27 fields covering pricing, technical specs (RAM, storage, display, battery), commercial terms, compliance (Energy Star, RoHS), logistics, warranty, and sustainability. What would you like to refine? For example: adjust the budget range, change delivery timeline, add specific processor requirements, or include a software bundle field.`,
  chairs: `I've drafted a detailed RFQ for 1,000 office chairs split into two lots (700 task + 300 executive) — 26 fields covering per-lot pricing with TCO, EN 1335 certification, ergonomic specs, installation plan, warranty, and sustainability. What would you like to change? For example: adjust the price range, add a fabric colour/finish field, change the warranty requirement, or add a local reference site visit field.`,
  routers: `I've drafted a comprehensive RFQ for 500 enterprise WiFi 6E access points — 27 fields covering hardware pricing, throughput specs, management platform, PoE requirements, NOC SLAs, 24/7 support, and sustainability. What would you like to refine? For example: specify a preferred vendor shortlist, add a redundancy/failover requirement, change the support SLA, or include an existing infrastructure compatibility field.`,
  all_three: `I've drafted a multi-lot RFQ covering all three categories — 29 fields across Lot 1 (1,000 laptops), Lot 2 (1,000 chairs), and Lot 3 (500 WiFi APs) — with per-lot pricing, grand total, and shared commercial terms. Vendors can bid on one lot or all three. What would you like to adjust? For example: change currencies, add a single-vendor preference clause, modify delivery timelines, or add a site visit / demo requirement.`,
};
