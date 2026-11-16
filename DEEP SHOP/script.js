const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const parcours = document.getElementById("parcours");
const stage = document.getElementById("stage");
const scenes = [...document.querySelectorAll(".scene")];
const nav = document.getElementById("nav-jours");
const barre = document.getElementById("barre");
const btnAjouter = document.getElementById("btn-ajouter");
const modal = document.getElementById("modal");
const formulaire = document.getElementById("formulaire");
const erreur = document.getElementById("erreur");

const N = scenes.length;   // 8 scènes : intro + 7 jours
const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const lissage = reduit ? 1 : 0.08;
const aujourdhui = (new Date().getDay() + 6) % 7;   // 0 = lundi

let cible = 0;     // progression réelle du scroll (0 à 1)
let courant = 0;   // progression lissée affichée

const borner = (x, min = 0, max = 1) => Math.min(max, Math.max(min, x));

/* ---------- Données ---------- */
// Anciennes versions : l'heure était un nombre (9). On la convertit en "09:00".
const enHeure = (v) => (typeof v === "number" ? String(v).padStart(2, "0") + ":00" : v);

function charger() {
  try {
    const brut = JSON.parse(localStorage.getItem("evenements")) || [];
    return brut.map((ev) => ({ ...ev, debut: enHeure(ev.debut), fin: enHeure(ev.fin) }));
  } catch (e) {
    return [];
  }
}

let evenements = charger();

function sauvegarder() {
  localStorage.setItem("evenements", JSON.stringify(evenements));
}

/* ---------- Navigation par jour ---------- */
const liens = COURTS.map((court, i) => {
  const lien = document.createElement("button");
  lien.type = "button";
  lien.className = "lien-jour" + (i === aujourdhui ? " aujourdhui" : "");
  lien.textContent = court;
  lien.addEventListener("click", () => allerA(i + 1));
  nav.appendChild(lien);
  return lien;
});

function allerA(indexScene) {
  const max = parcours.offsetHeight - window.innerHeight;
  window.scrollTo({ top: (indexScene / (N - 1)) * max, behavior: "smooth" });
}

/* ---------- Panneaux des jours ---------- */
const panneaux = JOURS.map((nom, i) => {
  const article = document.createElement("article");
  article.className = "jour";
  article.dataset.scene = i + 1;

  const titre = document.createElement("h2");
  titre.textContent = nom;

  const liste = document.createElement("ul");
  liste.className = "liste";

  article.append(titre, liste);
  stage.appendChild(article);
  return article;
});

function dessinerListes() {
  panneaux.forEach((panneau, i) => {
    const liste = panneau.querySelector(".liste");
    liste.innerHTML = "";

    const duJour = evenements
      .filter((ev) => ev.jour === i)
      .sort((a, b) => a.debut.localeCompare(b.debut));

    if (duJour.length === 0) {
      const vide = document.createElement("li");
      vide.className = "vide";
      vide.textContent = "Rien de prévu.";
      liste.appendChild(vide);
      return;
    }

    duJour.forEach((ev) => {
      const li = document.createElement("li");
      li.style.setProperty("--couleur", ev.couleur);

      const heure = document.createElement("span");
      heure.className = "heure";
      heure.textContent = `${ev.debut} – ${ev.fin}`;

      const nom = document.createElement("span");
      nom.textContent = ev.titre;   // textContent : pas d'injection HTML possible

      const suppr = document.createElement("button");
      suppr.type = "button";
      suppr.className = "suppr";
      suppr.textContent = "×";
      suppr.setAttribute("aria-label", "Supprimer " + ev.titre);
      suppr.dataset.id = ev.id;

      li.append(heure, nom, suppr);
      liste.appendChild(li);
    });
  });
}

// Suppression (un seul écouteur pour tous les boutons ×)
stage.addEventListener("click", (e) => {
  const bouton = e.target.closest(".suppr");
  if (!bouton) return;
  if (!confirm("Supprimer cet événement ?")) return;
  evenements = evenements.filter((ev) => ev.id !== bouton.dataset.id);
  sauvegarder();
  dessinerListes();
});

/* ---------- Formulaire ---------- */
btnAjouter.addEventListener("click", () => {
  // Jour proposé par défaut : celui de la scène affichée, sinon aujourd'hui
  const scene = Math.round(courant * (N - 1));
  formulaire.jour.value = scene >= 1 ? scene - 1 : aujourdhui;
  erreur.textContent = "";
  modal.showModal();
});

document.getElementById("btn-annuler").addEventListener("click", () => modal.close());

formulaire.addEventListener("submit", (e) => {
  e.preventDefault();

  const titre = formulaire.titre.value.trim();
  const jour = Number(formulaire.jour.value);
  const debut = formulaire.debut.value;
  const fin = formulaire.fin.value;

  if (!titre || !debut || !fin) {
    erreur.textContent = "Remplis le titre et les horaires.";
    return;
  }
  if (debut >= fin) {
    erreur.textContent = "L'heure de fin doit être après le début.";
    return;
  }

  // Chevauchement : deux plages se touchent si chacune commence avant la fin de l'autre
  const conflit = evenements.find(
    (ev) => ev.jour === jour && debut < ev.fin && ev.debut < fin
  );
  if (conflit) {
    erreur.textContent = `Chevauche « ${conflit.titre} » (${conflit.debut} – ${conflit.fin}).`;
    return;
  }

  evenements.push({
    id: Date.now().toString(),
    titre,
    jour,
    debut,
    fin,
    couleur: formulaire.couleur.value,
  });

  sauvegarder();
  dessinerListes();
  formulaire.reset();
  modal.close();
  allerA(jour + 1);   // on vole jusqu'au jour concerné
});

/* ---------- Animation au scroll ---------- */
function lireScroll() {
  const max = parcours.offsetHeight - window.innerHeight;
  cible = borner(window.scrollY / max);
}

function dessiner() {
  courant += (cible - courant) * lissage;
  const pos = courant * (N - 1);   // 0 = intro ... 7 = dimanche

  // Scènes : fondu enchaîné + zoom + flou
  scenes.forEach((scene, i) => {
    const d = pos - i;
    scene.style.opacity = 1 - borner(Math.abs(d));
    scene.style.transform = `scale(${1 + borner(d, 0, 1) * 0.35})`;
    scene.style.filter = `blur(${Math.abs(d) * 6}px)`;
  });

  // Textes et panneaux : visibles seulement près de leur scène
  stage.querySelectorAll("[data-scene]").forEach((el) => {
    const d = pos - Number(el.dataset.scene);
    const opacite = 1 - borner(Math.abs(d) * 2.4);
    el.style.opacity = opacite;
    el.style.setProperty("--d", d);
    el.style.setProperty("--abs", Math.abs(d));
    el.style.pointerEvents = opacite > 0.5 ? "auto" : "none";
  });

  // Navigation et progression
  liens.forEach((lien, i) => lien.classList.toggle("actif", i === Math.round(pos) - 1));
  barre.style.transform = `scaleX(${courant})`;

  requestAnimationFrame(dessiner);
}

window.addEventListener("scroll", lireScroll, { passive: true });
window.addEventListener("resize", lireScroll);

dessinerListes();
lireScroll();
dessiner();