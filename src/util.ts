export function csvline(data: any){
    return Object.keys(data).map((k: any) => {
        let p = data[k];
        if(k == 'sequence' || k == 'date'){
            p = parseInt(p);
        }

        let str = p;
        if(typeof p == 'boolean'){
            str = p.toString();
        }
        if(typeof p == 'number'){
            str = p.toString();
        }
        if(typeof p == 'string'){
            str = str.split(",").join('!C!');
        }

        return str;
    });
}

export function csvheader(data: any){
    return Object.keys(data).join(",")
}
