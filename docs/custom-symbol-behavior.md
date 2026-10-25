# Custom symbol behavior and state appearance

Edit a custom symbol using its pencil in the library. Description and behavior are shared with that symbol definition across projects. Built-in symbol overrides retain their existing precedence and engineering type.

- **Passive / flow-through**: no controllable state. Enable **Can vent to ambient**, save, then enable **Vents to ambient** in the placed component's inspector to make a nozzle/outlet. Existing instances are not automatically turned into outlets.
- **Valve**: Open/Closed controls, a default state for new instances, a default Cv, and valve SOP actions. Closed valves block the rough flow traversal. Existing instance states and Cv values are preserved when editing defaults.
- **Sensor / instrument**: select pressure, temperature, force/load, or another measurement and its unit. SOP reading checks use that unit. Temperature/force sensors do not receive invented pressure readings.
- **Electrical**: On/Off controls and SOP actions, initial conditions, and a power-loss state (Off by default). Power state does not gate a fluid path. This models switching and display only; no circuit, ignition, heating, or thermal calculation is performed.

The two state colors apply to vector shapes. Unchecked colors inherit the fluid color. Imported raster/SVG image assets retain their own colors. Select one or more drawn shapes and choose **Both states**, **On/Open only**, or **Off/Closed only** to construct different designs. Hidden-state shapes are faint in the workshop so they remain editable, and disappear in the placed symbol. The preview buttons switch between the two states. Bounds and connection geometry include both designs so switching state does not move pipes or lose the hit target.

Behavior and appearance are optional fields on `CustomSymbol`; legacy symbols retain their old behavior until configured. Placed custom components keep `customId` and their drawing while using the selected engineering `kind`. The existing binary `state` encoding remains `open`/`closed`; electrical UI and SOP text map this to On/Off. Electrical SOP actions are `on` and `off`, with normal initial/safing references and JSON import remapping.

Definitions and appearance are included in project JSON exports and shared-library saves. Imported project copies retain them; append imports remap symbol/component/SOP references as before. Reload older PropFlow tabs after deployment before editing these definitions.

Validation: `node scripts/check-symbol-behavior.mjs`, plus the planning, collaboration, custom-library, symbol-clipboard, and node-snap checks. The behavior suite exercises actual flow traversal for a passive nozzle, closed valve, and both electrical power states, and checks SOP inheritance, units, appearance, invalid metadata, and JSON round trips/remapping.
