Product Requirements Document — AI Professional Graphic Design Platform

Working Product Vision

Build a design platform that allows non-designers to create professional-quality flyers, posters, social graphics, event designs, church graphics, business promotions, birthday designs, wedding graphics, and related visual material without producing the typical visual defects associated with fully generative AI design tools.

The product will not ask an AI model to create the entire finished flyer as one flattened image.

Instead, the platform will:

1. Understand what the user wants.
2. Understand the content and assets the user provides.
3. Retrieve design principles and compositions from a curated library of excellent designs.
4. Develop an editable design specification.
5. Generate the composition using real fonts, real uploaded photographs, real logos, real shapes, real gradients, and deterministic layout rules.
6. Render everything at professional resolution.
7. Allow the user to edit every meaningful component.
8. Allow AI-assisted natural-language editing without destroying the original design.

The core product promise is:

Professional graphic design without looking AI-generated.

⸻

1. The Problem

Most current AI graphic-design workflows suffer from several problems.

1.1 Poor typography

Generative models often:

* distort words;
* misspell names;
* generate fake letters;
* use inconsistent fonts;
* create poor kerning;
* create weak typographic hierarchy;
* use too many font styles;
* position text badly;
* fail to respect margins.

Our system must never generate important text as pixels.

Text should remain actual editable text until final export.

1.2 Altered faces

Users may upload:

* pastors;
* celebrities;
* employees;
* couples;
* birthday celebrants;
* speakers;
* executives.

Traditional image generation may change facial identity, clothing, hands, jewellery, hairstyles, facial proportions, or body shape.

For normal flyer creation, our system should preserve the original uploaded photograph.

1.3 Mangled logos

Company, church, event, or organisation logos must remain exact.

The system should never regenerate a logo unless the user explicitly asks for a newly designed logo.

1.4 Random composition

A generative image model may produce something visually impressive but structurally inappropriate.

Professional designers deliberately control:

* hierarchy;
* balance;
* negative space;
* scale;
* alignment;
* rhythm;
* contrast;
* focal points;
* typography;
* texture;
* imagery;
* colour relationships.

Our platform needs to model these deliberately.

1.5 Poor editability

A generated JPEG is not a design.

Professional graphics contain objects and layers.

Our system therefore needs to store:

* people;
* text;
* logos;
* decorative elements;
* shapes;
* masks;
* overlays;
* backgrounds;
* shadows;
* gradients;
* effects;

as independent editable objects.

⸻

2. Product Philosophy

The system consists conceptually of three different layers.

Layer A — Design Intelligence

The AI understands:

* the brief;
* the visual hierarchy;
* the content;
* the target audience;
* the appropriate design language;
* suitable reference designs;
* layout decisions;
* typography decisions;
* colour decisions.

It behaves like an art director.

Layer B — Design Specification

The AI does not return an image.

It returns structured instructions describing the design.

Example:

{
  "canvas": {
    "width": 1080,
    "height": 1350
  },
  "background": {
    "type": "gradient",
    "direction": 135
  },
  "subject": {
    "asset_id": "person_01",
    "x": 540,
    "y": 810,
    "width": 700,
    "alignment": "center"
  },
  "headline": {
    "text": "SUNDAY SERVICE",
    "font_family": "Archivo Black",
    "font_size": 96,
    "font_weight": 800,
    "x": 70,
    "y": 120,
    "max_width": 940
  }
}

The production format will be considerably richer than this example.

Layer C — Rendering Engine

The renderer interprets the specification and creates the actual design.

The renderer controls:

* exact pixels;
* fonts;
* text wrapping;
* spacing;
* photographs;
* masks;
* clipping;
* SVG elements;
* gradients;
* effects;
* overlays;
* shadows;
* alignment.

This makes output reproducible and editable.

⸻

3. Initial Target Market

We should not launch as “AI Canva for everybody.”

The first market needs to be narrow enough that we can develop exceptional design intelligence.

Recommended first vertical

Church and ministry graphics

Examples:

* Sunday service graphics;
* sermon graphics;
* conference posters;
* prayer meeting designs;
* revival graphics;
* worship-night graphics;
* guest-minister flyers;
* anniversary designs;
* church-event graphics;
* Bible-study posters;
* social-media announcements.

Why this is an attractive starting point:

* enormous recurring design demand;
* churches frequently create multiple graphics every week;
* quality varies dramatically;
* many organisations cannot afford full-time designers;
* the design culture is visually rich;
* customers often need extremely fast turnaround;
* recurring subscriptions make sense.

The market can later expand to:

1. Events.
2. Birthdays.
3. Weddings.
4. Restaurants.
5. Beauty brands.
6. SMEs.
7. Nightlife.
8. Conferences.
9. Education.
10. Real estate.
11. Personal brands.
12. Corporate communications.

⸻

4. Core User Journey

Step 1 — Choose Design Type

User selects something such as:

Create Sunday Service Graphic

Other options could include:

* Conference
* Birthday
* Wedding
* Promotion
* New Product
* Restaurant
* Business
* Concert

⸻

5. Design Brief

Instead of throwing users into a blank canvas, ask a short conversational brief.

Example:

What are we designing?

Sunday Service.

Event title?

Supernatural Increase.

Church name?

Grace City Church.

Date?

September 13.

Time?

9:00 AM.

Location?

Lekki, Lagos.

Who should appear?

Pastor Daniel.

Design direction?

User chooses:

* Contemporary
* Premium
* Youthful
* Powerful
* Minimal
* Editorial
* Futuristic
* Elegant

Or describes the desired feeling.

⸻

6. Asset Upload

User uploads:

* pastor/speaker photograph;
* church logo;
* optional secondary photographs;
* sponsors;
* QR code;
* additional logos.

The system should immediately inspect the files.

⸻

7. Automatic Background Removal

For people, the system detects:

* head;
* hair;
* shoulders;
* clothing;
* hands;
* body;
* foreground objects.

The resulting cutout should preserve difficult boundaries such as:

* curly hair;
* braids;
* transparent fabric;
* glasses;
* fingers;
* loose clothing.

The user should be able to inspect the mask.

Offer:

Refine cutout

with:

* erase;
* restore;
* feather;
* edge refinement.

This should happen before design generation.

⸻

8. Asset Analysis

The system analyses every uploaded image.

For a portrait, determine:

* orientation;
* subject position;
* head location;
* body location;
* eye level;
* available negative space;
* clothing colours;
* dominant tones;
* photograph quality;
* whether the person is facing left/right/front.

This information is extremely important.

Example:

If the speaker faces left, the design system may position them on the right side so they visually face toward the headline.

That is the type of reasoning professional designers perform.

⸻

9. Design Reference Library

This becomes one of the most valuable parts of the product.

We curate thousands of high-quality designs.

However, do not simply feed 4,000 posters to an LLM every time a user creates something.

Instead, build an indexed design database.

Each reference should be analysed.

⸻

10. Reference Metadata

For every reference design, store attributes such as:

Category

* Church
* Conference
* Birthday
* Fashion
* Restaurant
* Wedding
* Business

Subcategory

Church:

* Sunday service
* conference
* worship
* youth
* prayer
* sermon series
* anniversary

Composition

Examples:

* portrait centred;
* portrait left;
* portrait right;
* typography dominant;
* two-person composition;
* three-speaker composition;
* full-bleed image;
* split composition;
* editorial grid.

Design Characteristics

* minimal;
* maximalist;
* brutalist;
* editorial;
* luxury;
* modern;
* youthful;
* energetic;
* corporate;
* cinematic;
* futuristic.

Typography

Record:

* number of font families;
* serif/sans/display;
* headline alignment;
* headline width;
* average font scale;
* supporting text hierarchy;
* tracking;
* line spacing.

Colour

Extract:

* dominant palette;
* accent colours;
* contrast level;
* monochromatic/polychromatic;
* warm/cool.

Image Treatment

Examples:

* clean cutout;
* duotone;
* monochrome;
* gradient map;
* glow;
* rim lighting;
* blur;
* halftone;
* grain;
* masked crop.

Layout Geometry

Estimate:

* subject bounding box;
* headline bounding box;
* logo area;
* footer area;
* whitespace regions;
* visual centre;
* alignment lines.

Quality Score

Internal designers rate each reference from perhaps:

1–100.

Only strong designs enter the production retrieval system.

⸻

11. Important Rule About Reference Designs

The system should learn:

design principles and composition characteristics

rather than reproduce another designer’s artwork pixel-for-pixel.

So instead of:

Copy this CCI graphic.

The system internally translates the preference into attributes such as:

* bold editorial typography;
* oversized condensed headline;
* aggressive scale contrast;
* sophisticated portrait treatment;
* restrained palette;
* strong photographic focal point;
* intentional whitespace;
* contemporary ministry aesthetic.

Then it can compose something original using those principles.

This makes the product much more defensible and much healthier creatively.

⸻

12. Similarity Search

When a user submits a brief, the system creates a query.

Example:

Contemporary Christian Sunday service poster, single male pastor, young audience, strong editorial headline, black/cream/yellow palette, high-energy modern ministry aesthetic.

The platform searches the reference database.

It might retrieve the 10–30 most relevant reference designs.

Those become contextual examples for the design planner.

⸻

13. Design DNA

Rather than storing reference designs only as images, create a proprietary representation called something like:

Design DNA

A Design DNA object might contain:

{
  "visual_weight": {
    "portrait": 0.48,
    "headline": 0.31,
    "secondary_text": 0.11,
    "decorations": 0.10
  },
  "composition": "asymmetric_right_subject",
  "headline_style": "oversized_condensed",
  "spacing": "generous",
  "energy": 0.82,
  "minimalism": 0.61,
  "contrast": 0.88
}

Over time this dataset becomes proprietary.

That becomes part of our moat.

⸻

14. The Design Planner

The LLM receives:

* user brief;
* asset analysis;
* brand information;
* design constraints;
* retrieved Design DNA;
* relevant reference descriptions;
* typography rules;
* layout rules;
* output dimensions.

It produces several compositions.

For example:

Concept A

Portrait dominant, typography on left.

Concept B

Large centred portrait with headline behind subject.

Concept C

Editorial layout with extremely large headline and smaller portrait.

The user can choose one or receive the strongest automatically.

⸻

15. Structured Design Document

Every generated design should become an internal document containing objects.

Conceptually:

Canvas
 ├── Background
 ├── Texture
 ├── Portrait
 │   ├── mask
 │   ├── shadow
 │   └── colour treatment
 ├── Headline
 ├── Subtitle
 ├── Date
 ├── Time
 ├── Location
 ├── Logo
 ├── CTA
 └── Decorative elements

Every object remains editable.

⸻

16. Renderer

Possible first implementation:

Frontend:

* React
* Next.js
* TypeScript

Canvas/editor:

* Konva.js

or:

* Fabric.js

or a custom SVG/Canvas engine later.

Server-side rendering:

* SVG
* Sharp
* Skia/Canvas where appropriate

Exports:

* PNG
* JPG
* PDF

Later:

* transparent PNG;
* multiple artboard formats;
* animation/video exports.

⸻

17. Typography Engine

Typography quality may determine whether the whole product succeeds.

The typography engine should enforce rules.

Examples:

No more than 2–3 font families unless a layout intentionally requires it.

Minimum readable size.

Minimum spacing from canvas boundaries.

Maximum line lengths.

Prevent:

* widows;
* orphaned words;
* accidental overlaps;
* awkward line breaks.

Automatically calculate:

* font size;
* line height;
* tracking;
* text-box dimensions.

Support optical hierarchy.

Example hierarchy:

EVENT NAME              96px
SERIES / CONTEXT        24px
DATE                     32px
LOCATION                 18px
CTA                      16px

The actual values are responsive rather than fixed.

⸻

18. Font Library

Use properly licensed fonts.

Integrate:

* Google Fonts;
* commercially licensed premium fonts later;
* potentially user-uploaded brand fonts for paid accounts.

Font metadata should include:

* visual category;
* width;
* personality;
* recommended pairings;
* supported weights;
* languages.

Example classification:

Bebas Neue

* condensed;
* bold;
* energetic;
* headline;
* modern.

This helps the design intelligence make appropriate choices.

⸻

19. Brand Kits

Users should be able to create a brand.

Brand Kit contains:

* logo;
* colours;
* preferred fonts;
* organisation name;
* address;
* website;
* social accounts;
* standard disclaimers;
* preferred design direction.

Church Brand Kit could contain:

* church logo;
* senior pastor;
* address;
* service times;
* social handles;
* website.

Then future designs become much faster.

⸻

20. Generate Button

After receiving the brief, user clicks:

Generate Designs

We produce perhaps three concepts.

Important:

These are not three random AI images.

They are three professional structured compositions.

⸻

21. Quality Assurance Engine

Before showing any generated design, run automated checks.

This is another critical differentiator.

Each design receives a quality score.

Check:

Typography

* overflow?
* clipped?
* too small?
* excessive fonts?
* poor line breaking?

Contrast

* readable text?
* WCAG-inspired contrast measurements where applicable?

Composition

* subject too close to edge?
* logo too close to crop?
* headline colliding with face?
* balance poor?

Safe Areas

* Instagram cropping considerations;
* story safe zones;
* print bleed where relevant.

Resolution

* photograph too low resolution?

Asset Integrity

* original logo intact?
* subject unchanged?

If score falls below threshold:

Do not show the design.

Regenerate/recompose automatically.

This is extremely important.

The user should never become the QA department.

⸻

22. Editing Experience

When the user opens a generated design, they see a simplified professional editor.

Left panel

* Uploads
* Photos
* Text
* Elements
* Logos
* Backgrounds
* Brand
* Layouts

Centre

Design canvas.

Right panel

Properties for selected object.

⸻

23. Direct Editing

Users can:

* drag;
* resize;
* rotate;
* duplicate;
* delete;
* reorder layers;
* change colours;
* change fonts;
* edit text;
* adjust line spacing;
* adjust tracking;
* crop photographs.

⸻

24. AI Editing

Add a command box:

Tell AI what to change

Examples:

Move the pastor slightly right.

Make the title bigger.

Give me a darker background.

Make this feel younger.

I want something more premium.

Reduce the clutter.

Put the logo at the top.

Try another font.

Give the pastor a subtle purple rim light.

The model interprets the request and modifies the design specification.

It does not regenerate the complete image.

⸻

25. Semantic Editing

This is potentially extremely powerful.

User can say:

The date isn’t visible enough.

The AI understands the actual design intent rather than merely executing coordinates.

It can respond by changing:

* size;
* contrast;
* position;
* spacing;
* background;
* typography.

⸻

26. Version History

Every AI modification creates another version.

Example:

v1 Original
v2 Larger headline
v3 Dark background
v4 Changed accent colour

Users can undo or restore any version.

⸻

27. Regeneration Options

Avoid a generic:

Regenerate

Instead provide meaningful controls:

* New composition
* New colour direction
* New typography
* New portrait treatment
* More minimal
* More energetic
* More premium
* More youthful
* More dramatic

This gives the user control over the design process.

⸻

28. Multiple Sizes

Once one design is approved, allow:

Resize Campaign

Automatically create:

* Instagram portrait — 1080×1350
* Instagram square — 1080×1080
* Story — 1080×1920
* X/Twitter post
* Facebook
* WhatsApp status
* YouTube thumbnail

The layout engine recomposes rather than simply stretching.

This could become one of the strongest paid features.

⸻

29. AI Architecture

Do not use one enormous model for everything.

Use specialised services.

Service 1 — Brief Understanding

Cheap LLM.

Responsibilities:

* understand request;
* extract fields;
* categorise design;
* generate retrieval query.

Service 2 — Design Planner

A stronger multimodal LLM.

Responsibilities:

* reason about composition;
* inspect reference designs;
* create layout specification;
* choose typography;
* choose palette.

Service 3 — Asset Analysis

Computer vision.

Responsibilities:

* face detection;
* subject detection;
* dominant colours;
* image quality;
* orientation.

Service 4 — Background Removal

Dedicated segmentation model/API.

Service 5 — Retrieval

Vector search.

Service 6 — Rendering

No LLM.

Deterministic graphics software.

Service 7 — Quality Control

Combination of:

* deterministic layout checks;
* computer vision;
* low-cost multimodal model.

⸻

30. Recommended LLM — MVP

Start by benchmarking:

GPT-5 mini

for design planning.

Why:

* inexpensive;
* accepts images;
* structured output;
* strong instruction following;
* good enough for controlled planning workflows;
* function/tool calling.

Crucially, the model should return something like:

{
  "layout": {},
  "typography": {},
  "assets": [],
  "effects": [],
  "background": {},
  "decorations": []
}

rather than an image.

⸻

31. Model Routing

We should eventually route requests.

Example:

Simple metadata extraction:

smallest capable model

Design planning:

GPT-5 mini or equivalent

Exceptional/complex composition:

larger model

Quality checking:

small multimodal model

This prevents us from paying premium-model prices for trivial work.

⸻

32. Cost Control

Keep prompts short.

Do not send 4,000 references to the LLM.

Instead:

4,000+ references

↓

vector/database search

↓

retrieve perhaps 10–20 relevant references

↓

send condensed Design DNA to LLM.

Cache:

* system instructions;
* design rules;
* brand-kit information;
* Design DNA;
* frequently used layouts.

⸻

33. What the AI Should Not Generate

For the normal workflow, avoid AI generation for:

* names;
* dates;
* event information;
* logos;
* QR codes;
* user’s face;
* important legal information.

These are deterministic assets.

⸻

34. Optional Generative Imagery

Generative image models can still be useful.

Use them for:

* abstract textures;
* atmospheric backgrounds;
* conceptual imagery;
* decorative objects;
* surreal visuals;
* clouds;
* light effects;
* background environments.

The renderer then combines those generated elements with real text and real uploaded assets.

⸻

35. Recommended Database

Use:

PostgreSQL

with:

pgvector

initially.

Store:

* users;
* designs;
* reference metadata;
* embeddings;
* design objects;
* brands;
* templates;
* generations;
* versions.

Object storage:

* Cloudflare R2;
* AWS S3;
* similar service.

⸻

36. Reference Library Data Model

Tables approximately:

reference_designs
design_embeddings
design_styles
design_categories
design_layouts
design_palettes
design_typography
design_quality_scores

One reference may carry multiple style labels.

⸻

37. Human Curation Pipeline

This is extremely important.

Do not scrape thousands of mediocre designs.

Start with perhaps:

300 exceptional references.

Then:

Then:

1,000.

Then:

3,000+.

Quality beats quantity.

Each item should pass human review.

Questions:

* Is typography excellent?
* Is hierarchy clear?
* Is composition intentional?
* Does it represent something worth learning?
* Is the style meaningfully different?
* Is it technically competent?

Reject mediocre work.

⸻

38. Designer Annotation Tool

Build a small internal application.

A curator uploads a reference and assigns:

* quality;
* category;
* audience;
* composition;
* typography;
* palette;
* style;
* energy;
* visual density.

AI can suggest tags.

Human approves.

This creates high-quality proprietary training/context data.

⸻

39. Later: Automatic Reference Analysis

As the library grows, use vision models to pre-analyse new references.

The model proposes:

* tags;
* palette;
* layout structure;
* typography classification;
* subject positions;
* style characteristics.

Human then validates the analysis.

This makes curation scalable.

⸻

40. Do We Need Fine-Tuning?

Not initially.

We should not start by fine-tuning a model on 4,000 posters.

Instead use:

RAG + Design DNA + structured generation + deterministic rendering.

After collecting thousands of successful user designs and preference decisions, we may have enough proprietary data for more specialised training.

⸻

41. Long-Term Learning System

Every interaction generates useful preference data.

Suppose the AI makes:

A, B, C.

User chooses B.

Then changes:

* headline;
* colour;
* spacing.

Then exports.

That tells us B was better than A and C.

Store anonymous/permissioned behavioural signals such as:

* selected concept;
* rejected concepts;
* changes made;
* time to export;
* whether regenerated;
* quality score.

Eventually we can build a ranking model.

⸻

42. Design Ranking Model

Generate perhaps 10 candidate layouts internally.

Do not display all 10.

Ranking model evaluates them.

Top three reach the user.

This creates:

Generator → Critic → Ranker → User

rather than:

Generator → User

That alone could substantially raise perceived quality.

⸻

43. Success Metrics

The most important metric should not be “number of generations.”

Track:

First-generation acceptance rate

Percentage of users who export without regenerating.

Target eventually:

>50%.

Time to usable design

How quickly user reaches an export-worthy design.

Regeneration rate

Lower is generally better.

Average manual edits

Helps identify weak areas.

Export rate

Sessions that end with export.

Repeat usage

Especially churches/businesses.

Subscription retention

Quality rating

Ask occasionally:

Would you confidently publish this design?

Yes/No.

That is a better metric than “Do you like it?”

⸻

44. Product Moat

The moat should gradually become:

1. Curated design intelligence

Thousands of excellent designs analysed structurally.

2. Design DNA database

Our proprietary understanding of visual composition.

3. Quality scoring system

Determines whether an output deserves to reach a customer.

4. User preference data

Millions of selections and edits.

5. Brand memory

Understanding recurring organisations’ styles.

6. Rendering technology

Strong deterministic composition engine.

7. Designer ecosystem

Potentially allow great designers to contribute design systems.

⸻

45. Designer Marketplace — Future

Professional designers create:

Design Systems

rather than static templates.

For example:

Modern Ministry Pack

contains:

* composition logic;
* fonts;
* palettes;
* texture treatments;
* subject placement styles;
* effects;
* decorative systems.

User buys/uses it.

Designer receives royalties.

Platform takes commission.

This means the platform does not have to replace designers.

It can monetise their taste.

⸻

46. User Personal Style Model

Later, each organisation builds its own visual memory.

After a user approves 20 designs, we understand:

* colours they like;
* fonts they reject;
* preferred composition;
* typical headline scale;
* minimalism preference;
* preferred portrait treatments.

Then:

Create another Sunday graphic

produces something naturally aligned with their identity.

⸻

47. Pricing Concept

Possible structure:

Free

* limited designs;
* watermark;
* basic templates;
* basic export.

Creator

Approximately $8–15/month depending on region.

Includes:

* more generations;
* HD export;
* no watermark;
* resizing;
* brand kit.

Pro

Approximately $20–35/month.

Includes:

* multiple brands;
* premium design systems;
* advanced editor;
* team capabilities;
* bulk campaigns.

Organisation

Church/business subscriptions.

Could include:

* multiple users;
* approval workflows;
* brand locking;
* asset library;
* recurring campaigns.

⸻

48. Credits

Avoid charging users per LLM token.

Consumers do not understand tokens.

Possible system:

1 design credit = generation of three concepts.

Edits should generally be inexpensive or free within reasonable usage.

Subscribers receive monthly design credits.

⸻

49. Mobile Strategy

Many potential customers, especially in emerging markets, work primarily from phones.

Therefore mobile web cannot be an afterthought.

Mobile flow:

1. Upload photo.
2. Type event information.
3. Generate.
4. Swipe between concepts.
5. Tap text/object to edit.
6. Ask AI for changes.
7. Export.

Advanced desktop editor can contain deeper controls.

⸻

50. MVP

Do not build everything.

Version 1 should accomplish one thing exceptionally well:

Create a professional church event poster from uploaded assets.

MVP requirements:

* account creation;
* project creation;
* church design category;
* asset upload;
* background removal;
* brief;
* design retrieval;
* Design DNA;
* AI planner;
* 3 structured compositions;
* rendering;
* basic editing;
* AI text commands;
* version history;
* PNG/JPG export;
* quality checks;
* payments.

No marketplace.

No video.

No collaboration.

No hundreds of categories.

⸻

51. MVP Style Coverage

Start with approximately 10–15 carefully curated visual directions.

For example:

1. Contemporary Ministry
2. Youth Conference
3. Premium Editorial
4. Powerful Revival
5. Clean Minimal
6. Worship Night
7. Cinematic
8. Modern African
9. Corporate Ministry
10. Bold Typography
11. Luxury Conference
12. Colourful Youth

Each direction can have many underlying layout patterns.

⸻

52. Phase 0 — Research

Before coding extensively:

Collect around 200–300 great graphics.

Analyse manually.

Identify:

* recurring layout patterns;
* typography patterns;
* colour structures;
* portrait treatments;
* information hierarchy.

Interview:

* church designers;
* pastors/media teams;
* freelance designers;
* non-designers responsible for church social media.

Questions:

* How many designs per week?
* Who currently makes them?
* How much do they pay?
* Biggest pain points?
* Turnaround time?
* What makes them reject a graphic?

⸻

53. Phase 1 — Prototype

Build the core technical proof.

One screen.

User uploads:

* portrait;
* logo.

Enters:

* event name;
* date;
* time.

System creates one editable 1080×1350 poster.

We are testing:

Can AI create excellent structured composition without generating the final image?

Do not build subscriptions yet.

⸻

54. Phase 2 — Design Intelligence

Build:

* reference ingestion;
* reference tagging;
* embeddings;
* retrieval;
* Design DNA;
* structured planner.

Test against perhaps 100 briefs.

Have professional designers score the output.

⸻

55. Phase 3 — Editor

Build:

* object selection;
* move;
* resize;
* text editing;
* font editing;
* colours;
* layer ordering;
* image replacement.

⸻

56. Phase 4 — Natural Language Edits

Implement instructions such as:

Make headline larger.

LLM receives current design JSON.

It returns a JSON patch.

Example:

{
  "operation": "update",
  "object_id": "headline_1",
  "changes": {
    "font_size": 110
  }
}

This is much cheaper than re-generating an entire design.

⸻

57. Phase 5 — Quality Gate

Implement automatic rejection of weak layouts.

Score:

* typography;
* hierarchy;
* collisions;
* contrast;
* margins;
* alignment;
* image resolution.

Only designs above threshold are displayed.

⸻

58. Phase 6 — Beta

Invite perhaps:

* 20 churches;
* 10 designers;
* 20 social-media managers.

Have them use it on actual work.

Measure:

* what they export;
* what they edit;
* what they reject.

Do not merely ask whether they like the idea.

Observe whether they actually publish the designs.

⸻

59. Phase 7 — Paid Launch

Start with:

Professional church graphics in minutes.

Not:

AI graphic-design generator.

The latter immediately associates the platform with cheap AI output.

Our marketing language should emphasise:

* professionally composed;
* editable;
* brand-safe;
* pixel-perfect typography;
* original photos preserved;
* instant resize;
* professional design intelligence.

⸻

60. Suggested Technical Stack

Frontend

* Next.js
* React
* TypeScript
* Tailwind

Editor

* Konva.js initially

Backend

* Node.js/TypeScript

or

* Python/FastAPI for ML-heavy services.

Could run both.

Database

* PostgreSQL
* pgvector

Object Storage

* Cloudflare R2 or S3

Queue

* Redis/BullMQ

Authentication

* Clerk
* Auth0
* Supabase Auth

Payments

* Stripe globally
* Paystack/Flutterwave where appropriate

Rendering

* SVG
* Sharp
* headless browser rendering if needed

⸻

61. Internal Architecture

                   USER
                     │
                     ▼
              DESIGN BRIEF
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
    ASSET ANALYSIS        BRIEF ANALYSIS
          │                     │
          └──────────┬──────────┘
                     ▼
              REFERENCE SEARCH
                     │
                     ▼
               DESIGN DNA
                     │
                     ▼
              DESIGN PLANNER
                     │
                     ▼
          STRUCTURED DESIGN JSON
                     │
                     ▼
             QUALITY CHECKER
                     │
              ┌──────┴──────┐
            fail           pass
              │              │
         recompose           ▼
                     RENDERING ENGINE
                            │
                            ▼
                         EDITOR
                            │
             ┌──────────────┴────────────┐
             ▼                           ▼
        MANUAL EDIT                  AI EDIT
             │                           │
             └──────────────┬────────────┘
                            ▼
                          EXPORT

⸻

62. The Most Important Technical Decision

The most important decision in this entire project is:

Do not represent a design internally as an image.

Represent it as:

a document.

An image is merely one possible export of that document.

That gives us:

* editability;
* responsive resizing;
* brand consistency;
* accurate typography;
* version control;
* programmatic QA;
* natural-language editing;
* template extraction;
* collaboration.

⸻

63. First Prototype Design Schema

Create an internal schema approximately containing:

Design
Canvas
Artboards
Layers
Layer:
- id
- type
- name
- x
- y
- width
- height
- rotation
- opacity
- zIndex
TextLayer:
- content
- fontFamily
- fontSize
- fontWeight
- lineHeight
- letterSpacing
- alignment
- colour
ImageLayer:
- asset
- crop
- mask
- filters
- objectPosition
ShapeLayer:
- type
- fill
- stroke
- radius
Effect:
- shadow
- blur
- glow
- blendMode

Never allow the LLM to write arbitrary code inside the renderer.

The model only outputs validated schema objects.

⸻

64. Guardrails

Validate every LLM response with a schema.

If model says:

font-size: banana

reject it.

If object coordinates leave the canvas:

correct them.

If model references unavailable font:

replace with approved alternative.

If image exceeds quality limits:

warn.

The AI proposes.

The engine enforces.

⸻

65. Design Evaluation Dataset

Create a benchmark before launch.

Example:

100 design briefs.

For every product release, generate results for all 100.

Professional designers evaluate:

* hierarchy;
* typography;
* visual balance;
* originality;
* readability;
* polish;
* brand appropriateness.

This prevents future model/algorithm changes from silently lowering quality.

⸻

66. Anti-Slop Score

Create a proprietary internal metric.

Call it something like:

Visual Quality Score — VQS

Possible score components:

Typography             20%
Composition            20%
Hierarchy              15%
Spacing                 10%
Contrast                10%
Asset integrity         10%
Style coherence         10%
Technical correctness    5%

Score:

0–100.

Perhaps do not show users any design under:

82/100.

The exact threshold should come from testing.

⸻

67. Why This Can Become Global

The rendering engine itself is culturally neutral.

What changes geographically is the:

* design reference library;
* typography;
* language;
* market preferences;
* payments;
* style packs.

Eventually users could choose:

* Lagos Contemporary
* London Editorial
* Seoul Minimal
* New York Corporate
* Nairobi Youth
* Accra Event
* Brazilian Festival

Not as stereotypes, but as curated design ecosystems contributed by local designers.

⸻

68. Business Flywheel

The ideal flywheel is:

More customers

↓

more design choices

↓

more preference data

↓

better ranking

↓

better first-generation quality

↓

more exports

↓

more customers

↓

more designers contribute styles

↓

larger design ecosystem

↓

stronger product.

⸻

69. What We Should NOT Do

Do not begin by:

* training our own foundation model;
* scraping millions of random posters;
* building a Canva clone;
* offering 100 categories;
* generating the entire design as one AI image;
* depending on prompt engineering alone;
* creating a huge editor before proving the design engine;
* attempting global launch immediately.

⸻

70. The First Technical Experiment

Before spending heavily, run this experiment.

Take:

50 excellent church posters.

Manually describe their structural characteristics.

Create:

10 design briefs.

Create:

10 user portrait/logo combinations.

Ask the planner to generate structured layouts.

Render them programmatically.

Have:

3–5 professional designers

blindly evaluate them.

Ask only:

“Would you allow a paying client to publish this?”

If results are poor, improve the Design DNA/layout system.

If results are strong, expand.

That test can validate the central hypothesis before building the complete company.

⸻

71. Suggested First-Team Composition

A serious MVP could begin with:

Product/Founder

Own:

* vision;
* user research;
* references;
* product decisions.

Full-stack engineer

Own:

* application;
* backend;
* accounts;
* projects;
* infrastructure.

Graphics/editor engineer

Own:

* canvas;
* rendering;
* layout engine;
* exports.

AI engineer

Could initially overlap with engineering role.

Own:

* retrieval;
* planner;
* schemas;
* model routing;
* evaluation.

Exceptional graphic designer

This person is essential.

Not decorative.

They help encode:

* taste;
* design rules;
* benchmark quality;
* references;
* evaluation.

A product designed to automate good design needs a genuinely good designer involved from the beginning.

⸻

72. North Star

The product succeeds when this happens:

Someone uploads a mediocre phone photograph, a church logo, and event details.

They click once.

Within the generated concepts there is a graphic that an experienced designer could look at and say:

“This is properly designed.”

The text is perfect.

The pastor still looks exactly like themselves.

The logo is untouched.

The hierarchy makes sense.

The spacing is deliberate.

The composition feels human.

And if the customer wants a change, they can simply say:

“Make it feel more youthful but keep everything else.”

The system understands exactly what that means.

That is the product.

Not an AI image generator.

An AI-native professional design system.