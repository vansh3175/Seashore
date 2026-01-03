import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/utils/prisma';
import { auth } from '@clerk/nextjs/server';

export async function GET(res:NextResponse,req:NextRequest) {
    const {userId} = await auth();
    if(!userId){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    try{
        const studios = await prisma.studio.findMany({
            where:{
                ownerId: userId
            },
            include:{
                _count:
                {
                    select:{
                        sessions: true
                    }
                }
            }
        })

        return NextResponse.json({studios},{status: 200});
    }
    catch(error){
        console.error("Error fetching studios:", error);
        return NextResponse.json({error: "Internal Server Error"}, {status: 500});
    }

    
}

export async function POST(req:NextRequest, res:NextResponse){
    const {userId} = await auth();
    if(!userId){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    console.log("AUTH:", userId);


    try{
        const body = await req.json();
        const {name} = body;
        
        const newStudio = await prisma.studio.create({
            data:{
                name,
                ownerId: userId
            }
        });
        return NextResponse.json({studio: newStudio}, {status: 201});

    }
    catch(error){
        console.error("Error creating studio:", error);
        return NextResponse.json({error: "Internal Server Error"}, {status: 500});
    }
}