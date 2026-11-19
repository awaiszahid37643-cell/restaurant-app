import { neon } from "@neondatabase/serverless";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

type MenuItem = {
  id: number;
  name: string;
  price: string;
  description: string;
};

const serif = "font-[family-name:var(--font-playfair)]";
const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=800&auto=format&fit=crop&q=80`;

// Har cuisine ki tasveerein (aap yahan apni pasand ki links bhi laga sakte hain)
const CUISINE_IMAGES: Record<string, string[]> = {
  Italian: [U("1565299624946-b28f40a0ae38"), U("1621996346565-e3dbc646d9a9")],
  Japanese: [U("1579871494447-9811cf80d66c"), U("1569718212165-3a8278d5f624")],
  Mexican: [U("1565299585323-38d6b0865b47"), U("1551504734-5ee1c4a1479b")],
  Indian: [U("1585937421612-70a008356fbe"), U("1567188040759-fb8a883dc6d8")],
  Pakistani: [U("1567188040759-fb8a883dc6d8"), U("1585937421612-70a008356fbe")],
  American: [U("1568901346375-23c9450c58cd"), U("1600891964092-4316c288032e")],
  French: [U("1555507036-ab1f4038808a"), U("1414235077428-338989a2e8c0")],
  Thai: [U("1559314809-0d155014e29e")],
  Spanish: [U("1515443961218-a51367888e4b")],
  Greek: [U("1546069901-ba9599a7e63c")],
};
const DEFAULT_IMAGES = [
  U("1504674900247-0877df9cc836"),
  U("1546069901-ba9599a7e63c"),
  U("1555939594-58d7cb561ad1"),
];

// Description ka format: "Cuisine · description"
function parseItem(item: MenuItem) {
  const parts = item.description.split(" · ");
  if (parts.length > 1) {
    return { cuisine: parts[0].trim(), text: parts.slice(1).join(" · ") };
  }
  return { cuisine: "", text: item.description };
}

function imageFor(cuisine: string, id: number) {
  const pool = CUISINE_IMAGES[cuisine] ?? DEFAULT_IMAGES;
  return pool[id % pool.length];
}

async function setupDatabase() {
  const check = await sql`SELECT to_regclass('public.menu_items') AS t`;
  if (check[0].t) return; // table pehle se bani hui hai

  await sql`
    CREATE TABLE menu_items (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      description TEXT NOT NULL DEFAULT ''
    )
  `;

  // Sirf pehli dafa table banne par starter dishes
  await sql`
    INSERT INTO menu_items (name, price, description) VALUES
    ('Margherita Pizza', 12.50, 'Italian · Wood-fired crust, San Marzano tomato, fresh mozzarella and basil.'),
    ('Spaghetti Carbonara', 14.00, 'Italian · Egg yolk, pecorino romano, crispy guanciale and black pepper.'),
    ('Tiramisu', 7.50, 'Italian · Espresso-soaked ladyfingers layered with mascarpone cream and cocoa.'),
    ('Salmon Nigiri Platter', 18.00, 'Japanese · Eight pieces of hand-pressed nigiri with fresh wasabi and pickled ginger.'),
    ('Tonkotsu Ramen', 15.50, 'Japanese · Rich pork broth, chashu, soft egg, nori and springy noodles.'),
    ('Tacos al Pastor', 11.00, 'Mexican · Marinated pork, pineapple, onion and coriander on warm corn tortillas.'),
    ('Chicken Quesadilla', 10.50, 'Mexican · Grilled chicken and melted cheese in a crisp tortilla with salsa roja.'),
    ('Butter Chicken', 14.50, 'Indian · Tandoori chicken in a velvety tomato and butter gravy, served with naan.'),
    ('Paneer Tikka', 12.00, 'Indian · Charred cottage cheese marinated in yoghurt and spices, with mint chutney.'),
    ('Chicken Karahi', 15.00, 'Pakistani · Tender chicken cooked with tomato, ginger and green chilli in a wok.'),
    ('Seekh Kebab Platter', 13.50, 'Pakistani · Juicy minced beef skewers grilled over charcoal with raita and naan.'),
    ('Smoky BBQ Burger', 13.25, 'American · Beef patty, aged cheddar, crispy onion rings and house BBQ sauce.'),
    ('Grilled Ribeye Steak', 28.00, 'American · 300g ribeye with garlic butter, roasted potatoes and seasonal greens.'),
    ('Butter Croissant', 5.00, 'French · Flaky, golden and baked fresh every morning.'),
    ('French Onion Soup', 9.00, 'French · Slow-caramelised onions in beef broth, topped with melted gruyere.'),
    ('Pad Thai', 13.00, 'Thai · Rice noodles tossed with tamarind, peanuts, bean sprouts and prawns.'),
    ('Seafood Paella', 19.50, 'Spanish · Saffron rice with prawns, mussels, calamari and fresh herbs.'),
    ('Greek Salad', 9.50, 'Greek · Tomato, cucumber, olives and feta with oregano and olive oil.'),
    ('Chicken Souvlaki', 12.50, 'Greek · Grilled chicken skewers with tzatziki, pita and lemon potatoes.'),
    ('Kung Pao Chicken', 12.75, 'Chinese · Wok-fried chicken with peanuts, dried chilli and Sichuan pepper.')
  `;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ cuisine?: string }>;
}) {
  await setupDatabase();
  const { cuisine: active } = await searchParams;

  // ---- ADD DISH ----
  async function addItem(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const cuisine = String(formData.get("cuisine") ?? "").trim();
    const text = String(formData.get("description") ?? "").trim();
    const price = parseFloat(String(formData.get("price") ?? ""));
    if (!name || !Number.isFinite(price) || price < 0) return;

    const description = cuisine ? `${cuisine} · ${text}` : text;
    await sql`INSERT INTO menu_items (name, price, description)
              VALUES (${name}, ${price}, ${description})`;
    revalidatePath("/");
  }

  // ---- REMOVE DISH ----
  async function deleteItem(formData: FormData) {
    "use server";
    const id = parseInt(String(formData.get("id")), 10);
    if (!Number.isInteger(id)) return;

    await sql`DELETE FROM menu_items WHERE id = ${id}`;
    revalidatePath("/");
  }

  // ---- SHOW ALL DISHES ----
  const all = (await sql`
    SELECT id, name, price, description FROM menu_items ORDER BY id
  `) as MenuItem[];

  const parsed = all.map((item) => ({ ...item, ...parseItem(item) }));
  const cuisines = [...new Set(parsed.map((p) => p.cuisine).filter(Boolean))];
  const shown = active ? parsed.filter((p) => p.cuisine === active) : parsed;

  const inputClass =
    "w-full border border-stone-700 bg-transparent px-4 py-3 text-stone-100 placeholder-stone-500 outline-none focus:border-amber-500";
  const chip = (on: boolean) =>
    `border px-4 py-2 text-xs tracking-widest transition ${
      on
        ? "border-amber-500 bg-amber-500 text-black"
        : "border-stone-700 text-stone-300 hover:border-amber-500 hover:text-amber-500"
    }`;

  return (
    <>
      {/* ---------- NAVBAR ---------- */}
      <nav className="fixed top-0 z-50 flex w-full items-center justify-between bg-[#0f0d0b]/90 px-6 py-4 backdrop-blur md:px-12">
        <a href="#home" className={`${serif} text-2xl text-amber-500`}>
          Atlas Kitchen.
        </a>
        <div className="flex gap-5 text-xs tracking-widest md:gap-8">
          <a href="#home" className="hover:text-amber-500">HOME</a>
          <a href="#about" className="hover:text-amber-500">ABOUT</a>
          <a href="#menu" className="hover:text-amber-500">MENU</a>
          <a href="#contact" className="hover:text-amber-500">CONTACT</a>
        </div>
      </nav>

      {/* ---------- HERO ---------- */}
      <section
        id="home"
        className="flex min-h-screen items-center justify-center px-6 text-center"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,13,11,.7), rgba(15,13,11,.88)), url(https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&auto=format&fit=crop&q=80)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-3xl">
          <p className="mb-4 text-xs tracking-[0.35em] text-amber-500">
            WORLD CUISINE · ONE TABLE
          </p>
          <h1 className={`${serif} text-5xl leading-tight text-white md:text-7xl`}>
            Taste the World, One Plate at a Time
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-stone-300">
            From Italian kitchens to Tokyo ramen bars and Lahore karahis, enjoy
            the best flavors of every continent under one roof.
          </p>
          <a
            href="#menu"
            className="mt-10 inline-block border border-amber-500 px-8 py-3 text-xs tracking-widest text-amber-500 transition hover:bg-amber-500 hover:text-black"
          >
            EXPLORE OUR MENU
          </a>
        </div>
      </section>

      {/* ---------- ABOUT ---------- */}
      <section
        id="about"
        className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 md:grid-cols-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1000&auto=format&fit=crop&q=85"
          alt="Restaurant dining table"
          className="h-[420px] w-full object-cover"
        />
        <div>
          <p className="mb-3 text-xs tracking-[0.35em] text-amber-500">
            OUR STORY
          </p>
          <h2 className={`${serif} text-4xl text-white md:text-5xl`}>
            A Journey Across Kitchens.
          </h2>
          <p className="mt-6 text-stone-400">
            Atlas Kitchen was built on one idea: great food has no borders. Our
            chefs bring authentic recipes from around the globe, prepared with
            fresh ingredients and traditional techniques.
          </p>
          <div className="mt-8 flex gap-10">
            <div>
              <p className={`${serif} text-4xl text-amber-500`}>{cuisines.length || 10}+</p>
              <p className="text-xs tracking-widest text-stone-500">CUISINES</p>
            </div>
            <div>
              <p className={`${serif} text-4xl text-amber-500`}>{all.length}</p>
              <p className="text-xs tracking-widest text-stone-500">DISHES</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- QUOTE ---------- */}
      <section className="bg-amber-500/10 px-6 py-20 text-center">
        <h2 className={`${serif} mx-auto max-w-3xl text-3xl italic text-white md:text-4xl`}>
          “The world is a menu. Come hungry.”
        </h2>
      </section>

      {/* ---------- MENU (NeonDB se) ---------- */}
      <section id="menu" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-10 text-center">
          <p className="mb-3 text-xs tracking-[0.35em] text-amber-500">
            AUTHENTIC · FRESH · SHARED
          </p>
          <h2 className={`${serif} text-4xl text-white md:text-5xl`}>
            Our International Menu
          </h2>
        </div>

        {/* Cuisine filter */}
        <div className="mb-12 flex flex-wrap justify-center gap-3">
          <a href="/#menu" className={chip(!active)}>ALL</a>
          {cuisines.map((c) => (
            <a
              key={c}
              href={`/?cuisine=${encodeURIComponent(c)}#menu`}
              className={chip(active === c)}
            >
              {c.toUpperCase()}
            </a>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="text-center text-stone-500">
            No dishes found. Add a dish below.
          </p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((item) => (
              <article
                key={item.id}
                className="group flex flex-col overflow-hidden border border-stone-800 bg-stone-900/40"
              >
                <div className="relative h-56 overflow-hidden bg-gradient-to-br from-stone-800 to-stone-900">
                  <div
                    className="h-full w-full bg-cover bg-center transition duration-500 group-hover:scale-105"
                    style={{
                      backgroundImage: `url(${imageFor(item.cuisine, item.id)})`,
                    }}
                  />
                  {item.cuisine && (
                    <span className="absolute left-3 top-3 bg-black/70 px-3 py-1 text-[10px] tracking-widest text-amber-500">
                      {item.cuisine.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className={`${serif} text-xl text-white`}>{item.name}</h3>
                    <span className="font-semibold text-amber-500">
                      ${Number(item.price).toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-3 flex-1 text-sm text-stone-400">{item.text}</p>
                  <form action={deleteItem} className="mt-5">
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      type="submit"
                      className="text-xs tracking-widest text-stone-500 underline hover:text-red-500"
                    >
                      REMOVE DISH
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* ---------- ADD DISH FORM ---------- */}
        <div className="mx-auto mt-20 max-w-xl border border-stone-800 p-8">
          <h3 className={`${serif} mb-6 text-2xl text-white`}>Add a New Dish</h3>
          <form action={addItem} className="grid gap-4">
            <input
              name="name"
              type="text"
              required
              maxLength={100}
              placeholder="Dish name"
              className={inputClass}
            />
            <input
              name="cuisine"
              type="text"
              list="cuisine-list"
              placeholder="Cuisine (e.g. Italian)"
              className={inputClass}
            />
            <datalist id="cuisine-list">
              {cuisines.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <input
              name="price"
              type="number"
              required
              min="0"
              step="0.01"
              placeholder="Price (e.g. 14.99)"
              className={inputClass}
            />
            <textarea
              name="description"
              rows={3}
              placeholder="Short description"
              className={inputClass}
            />
            <button
              type="submit"
              className="bg-amber-500 px-6 py-3 text-xs font-semibold tracking-widest text-black transition hover:bg-amber-400"
            >
              ADD DISH
            </button>
          </form>
        </div>
      </section>

      {/* ---------- CONTACT ---------- */}
      <section id="contact" className="bg-amber-500/10 px-6 py-24 text-center">
        <p className="mb-3 text-xs tracking-[0.35em] text-amber-500">
          RESERVE A TABLE
        </p>
        <h2 className={`${serif} text-4xl text-white md:text-5xl`}>
          Your Seat Around the World
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-stone-400">
          Open daily from 12 PM to 11 PM. Book a table for family dinners,
          birthdays and special evenings.
        </p>
        <a
          href="mailto:hello@atlaskitchen.com"
          className="mt-10 inline-block border border-amber-500 px-8 py-3 text-xs tracking-widest text-amber-500 transition hover:bg-amber-500 hover:text-black"
        >
          BOOK A TABLE
        </a>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="px-6 py-12 text-center">
        <h2 className={`${serif} text-3xl text-amber-500`}>Atlas Kitchen.</h2>
        <p className="mt-2 text-xs tracking-[0.3em] text-stone-500">
          FLAVORS FROM EVERY CORNER OF THE WORLD
        </p>
        <div className="mt-6 flex justify-center gap-6 text-sm text-stone-400">
          <a href="#home" className="hover:text-amber-500">Home</a>
          <a href="#about" className="hover:text-amber-500">About</a>
          <a href="#menu" className="hover:text-amber-500">Menu</a>
          <a href="#contact" className="hover:text-amber-500">Contact</a>
        </div>
        <p className="mt-8 text-xs text-stone-600">
          © 2026 Atlas Kitchen. All rights reserved.
        </p>
      </footer>
    </>
  );
}