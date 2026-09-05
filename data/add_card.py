import sys, pathlib, random, json

absolute = "F:/Projets/ML/Sites/site vibe coder/fichiers du site/site complet/data/"

images = pathlib.Path(absolute+"cards_img/unused")

animations = ["heart_burst",
  "sparkles",
  "petals",
  "butterflies",
  "fireflies",
  "stars", 
  "confetti"]

with open(absolute+"cards.json", "r", encoding="utf-8") as f:
    cards = json.load(f)
n = len(cards)

def change_animation():
    with open(absolute+"cards.json", "r", encoding="utf-8") as f:
            cards = json.load(f)

    action = random.sample if len(animations)>=len(cards) else random.choics
    anims = action(animations, len(cards))

    for anim, card in zip(anims, cards):
        card["animation"]=anim

    with open(absolute+"cards.json", "w", encoding='utf-8') as f:
            json.dump(cards, f, indent=4, ensure_ascii=False)

def add(x):
    l_img = list(images.iterdir())
    x = min(x, len(l_img))

    ids = ["card-"+str(n+i).rjust(3, "0") for i in range(1, x+1)]
    imgs = random.sample(l_img, x)
    imgs = [f.rename(f"{absolute}cards_img/card{str(n+i)}.webp") for f, i in zip(imgs, range(1, x+1))]
    anims = random.choices(animations, k=x)
    for id, img, anim in zip(ids, imgs, anims):
        cards.append({"id": id, "image": absolute+str(img), "character": "unknown", "anime": "unknown", "quote": "unknown", "animation": anim, "author": "unknown"})
    with open("cards.json", "w", encoding="utf-8") as f:
        json.dump(cards, f, indent=4, ensure_ascii=False)

def complete():
    with open(absolute+"cards.json", "r", encoding="utf-8") as f:
        cards = json.load(f)
    
    print("Instructions:\n - Veuillez completer les informations manquantes des cartes suivantes.\n - pour quittez dans n'importe quel champ de texte taper 'quit' ou 'exit' ou '-q'\n - pour vaider appuyer sur 'entrer'\n - pour laisser un champ incomplété appuyer sur 'entrer' sans rien mettre, un espace 'none' ou 'unknown'.\n")
    quit, rien = ['quit', 'exit', '-q'], ['', 'none', 'unknown']
    to_break = False
    for card in cards:
        if to_break: break
        n=0
        id = card["id"]
        for e in card:
            if card[e] in rien:
                n+=1
                if n==1:
                    print(f"=================================card id: {id}=========================================\n")
                value = input(f"    {e}: ")
                if value.lower() in quit: 
                    to_break = True
                    break
                elif value.strip().lower() in rien: card[e]="unknown"
                card[e] = value
        print("\n")
    with open(absolute+"cards.json", "w", encoding='utf-8') as f:
        json.dump(cards, f, indent=4, ensure_ascii=False)

l = sys.argv
t = len(l)
if t>1:
    e = sys.argv[1]
    if e.isdigit():
        add(int(e))
    else:
        complete()
else:
    choix = input("Veuillez choisir une option à exécuter: \n 1- add \n 2- *complete\n\n choix[choisir le numero ou taper l'action correspondante. l'option 'complete' est choisie par défaut]: ")
    a = ['add', '1']
    if choix in a:
        val = input("Veuillez entrer le nombre de cartes à ajouter[entrez un nombre entier '1' est choisi par defaut]: ")
        val = int(val) if val.isdigit() else 1
        add(val)
    else: complete()

change_animation()